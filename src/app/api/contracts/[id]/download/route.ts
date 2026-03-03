// src/app/api/contracts/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { generateSignedUrl } from '@/lib/s3';

// GET /api/contracts/[id]/download - Download contract PDF
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
                signers: { select: { email: true } },
            },
        });

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        const user = await prisma.user.findFirst({
            where: { id: jwtUser.userId || jwtUser.id },
        });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const isAdminOrManager = user.role === 'admin' || user.role === 'manager';
        const isSigner = contract.signers.some((s: { email: string }) => s.email === user.email);

        // if (!isAdminOrManager && !isSigner) {
        //     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        // }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');

        const s3Key = type === 'signed' && contract.signedS3Key
            ? contract.signedS3Key
            : contract.s3Key;

        const downloadUrl = await generateSignedUrl(s3Key);

        return NextResponse.json({ downloadUrl, fileName: contract.fileName });
    } catch (error: any) {
        console.error('GET /api/contracts/[id]/download error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
