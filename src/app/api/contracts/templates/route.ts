// src/app/api/contracts/templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { uploadContractToS3 } from '@/lib/contracts';

// GET /api/contracts/templates - List templates
export async function GET(req: NextRequest) {
    try {
        const jwtUser = getUserFromToken(req);
        if (!jwtUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const templates = await prisma.contractTemplate.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(
            templates.map((t: any) => ({
                ...t,
                fileSize: t.fileSize.toString(),
            }))
        );
    } catch (error: any) {
        console.error('GET /api/contracts/templates error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

// POST /api/contracts/templates - Create a template
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
        const name = formData.get('name') as string;
        const description = formData.get('description') as string | null;

        if (!file || !name) {
            return NextResponse.json({ error: 'File and name are required' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await uploadContractToS3(buffer, file.name, 'contracts/templates');

        const template = await prisma.contractTemplate.create({
            data: {
                name,
                description,
                s3Key: result.s3Key,
                fileName: file.name,
                fileSize: BigInt(result.fileSize),
                createdById: user.id,
            },
        });

        return NextResponse.json({
            ...template,
            fileSize: template.fileSize.toString(),
        });
    } catch (error: any) {
        console.error('POST /api/contracts/templates error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
