// src/app/api/contracts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { uploadContractToS3, generateSignToken } from '@/lib/contracts';

// GET /api/contracts - List contracts
export async function GET(req: NextRequest) {
    try {
        const jwtUser = getUserFromToken(req);
        if (!jwtUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findFirst({
            where: { id: jwtUser.userId || jwtUser.id },
        });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        let whereClause: any = {};

        // Role-based filtering
        if (user.role === 'admin' || user.role === 'manager') {
            if (status && status !== 'all') {
                whereClause.status = status;
            }
        } else if (user.role === 'client') {
            whereClause.signers = {
                some: { email: user.email },
            };
            if (status && status !== 'all') {
                whereClause.status = status;
            }
        } else {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (search) {
            whereClause.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        const contracts = await prisma.contract.findMany({
            where: whereClause,
            include: {
                signers: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        status: true,
                        signedAt: true,
                        role: true,
                    },
                },
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const serialized = contracts.map((c: any) => ({
            ...c,
            fileSize: c.fileSize.toString(),
        }));

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('GET /api/contracts error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/contracts - Create a new contract
export async function POST(req: NextRequest) {
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

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const title = formData.get('title') as string;
        const description = formData.get('description') as string | null;
        const message = formData.get('message') as string | null;
        const clientId = formData.get('clientId') as string | null;
        const expiresAt = formData.get('expiresAt') as string | null;
        const signersJson = formData.get('signers') as string | null;
        const templateId = formData.get('templateId') as string | null;

        if (!title) {
            return NextResponse.json({ error: 'Title is required' }, { status: 400 });
        }

        let s3Key: string;
        let fileName: string;
        let fileSize: number;

        if (file) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const result = await uploadContractToS3(buffer, file.name);
            s3Key = result.s3Key;
            fileName = file.name;
            fileSize = result.fileSize;
        } else if (templateId) {
            const template = await prisma.contractTemplate.findUnique({
                where: { id: templateId },
            });
            if (!template) {
                return NextResponse.json({ error: 'Template not found' }, { status: 404 });
            }
            s3Key = template.s3Key;
            fileName = template.fileName;
            fileSize = Number(template.fileSize);
        } else {
            return NextResponse.json(
                { error: 'Either a file or templateId is required' },
                { status: 400 }
            );
        }

        let signers: Array<{ name: string; email: string; role?: string; order?: number }> = [];
        if (signersJson) {
            try {
                signers = JSON.parse(signersJson);
            } catch {
                return NextResponse.json({ error: 'Invalid signers JSON' }, { status: 400 });
            }
        }

        const contract = await prisma.contract.create({
            data: {
                title,
                description,
                message,
                s3Key,
                fileName,
                fileSize: BigInt(fileSize),
                createdById: user.id,
                clientId,
                templateId,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
                signers: {
                    create: signers.map((s, index) => ({
                        name: s.name,
                        email: s.email,
                        role: s.role || 'signer',
                        order: s.order ?? index,
                        signToken: generateSignToken(),
                    })),
                },
                auditLogs: {
                    create: {
                        action: 'created',
                        performedBy: user.name || user.email,
                        details: JSON.stringify({
                            title,
                            signerCount: signers.length,
                            fileName,
                        }),
                    },
                },
            },
            include: {
                signers: true,
            },
        });

        return NextResponse.json({
            ...contract,
            fileSize: contract.fileSize.toString(),
        });
    } catch (error: any) {
        console.error('POST /api/contracts error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
