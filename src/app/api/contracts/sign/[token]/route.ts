// src/app/api/contracts/sign/[token]/route.ts
// Public endpoint - no auth required
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl } from '@/lib/s3';
import { uploadSignatureToS3, checkAndFinalizeContract } from '@/lib/contracts';
import { sendContractSignedNotification, sendContractCompletedEmail } from '@/lib/email';

// GET /api/contracts/sign/[token] - Get contract details for signing page
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        const signer = await prisma.contractSigner.findUnique({
            where: { signToken: token },
            include: {
                contract: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        status: true,
                        s3Key: true,
                        fileName: true,
                        message: true,
                        expiresAt: true,
                        annotations: true,
                        createdAt: true,
                        createdBy: {
                            select: { name: true, email: true },
                        },
                    },
                },
            },
        });

        if (!signer) {
            return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
        }

        const contract = signer.contract;

        if (contract.status === 'CANCELLED') {
            return NextResponse.json({ error: 'This contract has been cancelled' }, { status: 400 });
        }

        if (contract.status === 'EXPIRED' || (contract.expiresAt && new Date() > contract.expiresAt)) {
            return NextResponse.json({ error: 'This contract has expired' }, { status: 400 });
        }

        if (signer.status === 'PENDING') {
            await prisma.contractSigner.update({
                where: { id: signer.id },
                data: { status: 'VIEWED', viewedAt: new Date() },
            });

            await prisma.contractAuditLog.create({
                data: {
                    contractId: contract.id,
                    action: 'viewed',
                    performedBy: signer.name,
                    ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
                    userAgent: req.headers.get('user-agent') || 'unknown',
                },
            });
        }

        const pdfUrl = await generateSignedUrl(contract.s3Key);

        return NextResponse.json({
            signer: {
                id: signer.id,
                name: signer.name,
                email: signer.email,
                status: signer.status === 'PENDING' ? 'VIEWED' : signer.status,
                signedAt: signer.signedAt,
            },
            contract: {
                id: contract.id,
                title: contract.title,
                description: contract.description,
                message: contract.message,
                fileName: contract.fileName,
                pdfUrl,
                annotations: contract.annotations,
                createdAt: contract.createdAt,
                senderName: contract.createdBy.name || contract.createdBy.email,
            },
        });
    } catch (error: any) {
        console.error('GET /api/contracts/sign/[token] error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/contracts/sign/[token] - Submit a signature via public link
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        const body = await req.json();
        const { signatureData, signatureType } = body;

        if (!signatureData) {
            return NextResponse.json({ error: 'signatureData is required' }, { status: 400 });
        }

        const signer = await prisma.contractSigner.findUnique({
            where: { signToken: token },
            include: {
                contract: {
                    include: {
                        signers: true,
                        createdBy: { select: { name: true, email: true } },
                    },
                },
            },
        });

        if (!signer) {
            return NextResponse.json({ error: 'Invalid signing link' }, { status: 404 });
        }

        if (signer.status === 'SIGNED') {
            return NextResponse.json({ error: 'Already signed' }, { status: 400 });
        }

        if (signer.status === 'DECLINED') {
            return NextResponse.json({ error: 'Signer has declined' }, { status: 400 });
        }

        const contract = signer.contract;
        if (contract.status === 'CANCELLED' || contract.status === 'EXPIRED') {
            return NextResponse.json({ error: 'Contract is no longer active' }, { status: 400 });
        }

        if (contract.expiresAt && new Date() > contract.expiresAt) {
            await prisma.contract.update({
                where: { id: contract.id },
                data: { status: 'EXPIRED' },
            });
            return NextResponse.json({ error: 'Contract has expired' }, { status: 400 });
        }

        const signatureS3Key = await uploadSignatureToS3(signatureData, signer.id);
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
        const userAgent = req.headers.get('user-agent') || 'unknown';

        // Update annotations with filled values
        const fieldValues = body.fieldValues || {};
        let currentAnnotations = contract.annotations || [];
        if (typeof currentAnnotations === 'string') {
            try { currentAnnotations = JSON.parse(currentAnnotations); } catch { currentAnnotations = []; }
        }

        if (Array.isArray(currentAnnotations)) {
            const updatedAnnotations = currentAnnotations.map((ann: any) => {
                const filledValue = fieldValues[ann.id];
                if (filledValue !== undefined) {
                    // If it's a signature field, we might want to store the key or the fact it's signed
                    if (ann.type === 'signature' || ann.type === 'initials') {
                        return { ...ann, value: 'SIGNED', signatureS3Key };
                    }
                    return { ...ann, value: filledValue };
                }
                return ann;
            });

            await prisma.contract.update({
                where: { id: contract.id },
                data: { annotations: JSON.stringify(updatedAnnotations) }
            });
        }

        await prisma.contractSigner.update({
            where: { id: signer.id },
            data: {
                status: 'SIGNED',
                signedAt: new Date(),
                signatureS3Key,
                signatureType: signatureType || 'draw',
                ipAddress: ip,
                userAgent,
            },
        });

        await prisma.contractAuditLog.create({
            data: {
                contractId: contract.id,
                action: 'signed',
                performedBy: signer.name,
                ipAddress: ip,
                userAgent,
                details: JSON.stringify({ signerEmail: signer.email, signatureType: signatureType || 'draw' }),
            },
        });

        try {
            await sendContractSignedNotification({
                recipientEmail: contract.createdBy.email,
                recipientName: contract.createdBy.name || 'Admin',
                signerName: signer.name,
                contractTitle: contract.title,
            });
        } catch (err) {
            console.error('Failed to send signed notification:', err);
        }

        const completed = await checkAndFinalizeContract(contract.id, prisma);

        if (completed) {
            const allEmails = [
                { name: contract.createdBy.name || 'Admin', email: contract.createdBy.email },
                ...contract.signers.map((s: any) => ({ name: s.name, email: s.email })),
            ];
            for (const recipient of allEmails) {
                try {
                    await sendContractCompletedEmail({
                        recipientEmail: recipient.email,
                        recipientName: recipient.name,
                        contractTitle: contract.title,
                        downloadUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard`,
                    });
                } catch (err) {
                    console.error(`Failed to send completion email to ${recipient.email}:`, err);
                }
            }
        }

        return NextResponse.json({
            success: true,
            completed,
            message: completed ? 'Contract fully signed and completed!' : 'Signature recorded successfully.',
        });
    } catch (error: any) {
        console.error('POST /api/contracts/sign/[token] error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
