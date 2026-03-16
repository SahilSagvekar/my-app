// src/app/api/contracts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { uploadContractToS3, applyAnnotationsToBuffer, downloadPdfFromS3 } from '@/lib/contracts';
import { generateSignedUrl } from '@/lib/s3';

// GET /api/contracts/[id] - Get contract details
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const jwtUser = getUserFromToken(req);
        if (!jwtUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const contract = await prisma.contract.findUnique({
            where: { id },
            include: {
                signers: {
                    orderBy: { order: 'asc' },
                },
                auditLogs: {
                    orderBy: { createdAt: 'desc' },
                },
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
                template: {
                    select: { id: true, name: true },
                },
            },
        });

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        // Authorization check
        const user = await prisma.user.findFirst({
            where: { id: jwtUser.userId || jwtUser.id },
            include: { client: true }
        });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (user.role === 'client') {
            const isOwner = contract.clientId === user.linkedClientId || (user.client && contract.clientId === user.client.id);
            const isSigner = contract.signers.some(s => s.email === user.email);
            if (!isOwner && !isSigner) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else if (user.role !== 'admin' && user.role !== 'manager') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const pdfUrl = await generateSignedUrl(contract.s3Key);
        const signedPdfUrl = contract.signedS3Key
            ? await generateSignedUrl(contract.signedS3Key)
            : null;

        return NextResponse.json({
            ...contract,
            fileSize: contract.fileSize.toString(),
            pdfUrl,
            signedPdfUrl,
        });
    } catch (error: any) {
        console.error('GET /api/contracts/[id] error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// PATCH /api/contracts/[id] - Update contract metadata
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const jwtUser = getUserFromToken(req);
        if (!jwtUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { id: jwtUser.userId || jwtUser.id },
        });
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { action, message, title, description, expiresAt } = body;

        const contract = await prisma.contract.findUnique({ where: { id } });
        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        if (action === 'cancel') {
            if (contract.status === 'COMPLETED') {
                return NextResponse.json(
                    { error: 'Cannot cancel a completed contract' },
                    { status: 400 }
                );
            }

            await prisma.contract.update({
                where: { id },
                data: { status: 'CANCELLED', cancelledAt: new Date() },
            });

            await prisma.contractAuditLog.create({
                data: {
                    contractId: id,
                    action: 'cancelled',
                    performedBy: user.name || user.email,
                },
            });

            return NextResponse.json({ success: true });
        }

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (message !== undefined) updateData.message = message;
        if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

        const updated = await prisma.contract.update({
            where: { id },
            data: updateData,
            include: { signers: true },
        });

        return NextResponse.json({
            ...updated,
            fileSize: updated.fileSize.toString(),
        });
    } catch (error: any) {
        console.error('PATCH /api/contracts/[id] error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// PUT /api/contracts/[id] - Edit contract content (DRAFT only)
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const jwtUser = getUserFromToken(req);
        if (!jwtUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { id: jwtUser.userId || jwtUser.id },
        });
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const contract = await prisma.contract.findUnique({ where: { id } });
        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        if (contract.status !== 'DRAFT') {
            return NextResponse.json(
                { error: 'Only DRAFT contracts can be edited' },
                { status: 400 }
            );
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const annotationsStr = formData.get('annotations') as string | null;

        let result;
        const updateData: any = {};

        if (file) {
            const buffer = Buffer.from(await file.arrayBuffer());
            result = await uploadContractToS3(buffer, contract.fileName);
            updateData.s3Key = result.s3Key;
            updateData.fileSize = BigInt(result.fileSize);
        }

        if (annotationsStr) {
            const parsedAnnotations = JSON.parse(annotationsStr);
            updateData.annotations = parsedAnnotations;

            // Bake text annotations into the actual PDF
            try {
                const s3Key = updateData.s3Key || contract.s3Key;
                let pdfBuffer = await downloadPdfFromS3(s3Key);
                pdfBuffer = await applyAnnotationsToBuffer(pdfBuffer, parsedAnnotations);
                const uploadResult = await uploadContractToS3(pdfBuffer, contract.fileName);
                updateData.s3Key = uploadResult.s3Key;
                updateData.fileSize = BigInt(uploadResult.fileSize);
            } catch (applyErr) {
                console.error('Failed to apply annotations to PDF:', applyErr);
                // Still save the annotations metadata even if PDF baking fails
            }
        }

        const updated = await prisma.contract.update({
            where: { id },
            data: updateData,
        });

        await prisma.contractAuditLog.create({
            data: {
                contractId: id,
                action: 'edited',
                performedBy: user.name || user.email,
                details: JSON.stringify({
                    message: file ? 'Contract PDF and annotations were updated' : 'Contract annotations were updated',
                    hasFile: !!file,
                    hasAnnotations: !!annotationsStr
                }),
            },
        });

        return NextResponse.json({
            ...updated,
            fileSize: updated.fileSize.toString(),
        });
    } catch (error: any) {
        console.error('PUT /api/contracts/[id] error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
