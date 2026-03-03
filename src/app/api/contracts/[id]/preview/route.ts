// src/app/api/contracts/[id]/preview/route.ts
// Proxy PDF from S3 to avoid cross-origin iframe blocking
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { downloadPdfFromS3 } from '@/lib/contracts';

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
        const type = req.nextUrl.searchParams.get('type') || 'original';

        const contract = await prisma.contract.findUnique({
            where: { id },
            select: { s3Key: true, signedS3Key: true, fileName: true },
        });

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        const s3Key = type === 'signed' && contract.signedS3Key
            ? contract.signedS3Key
            : contract.s3Key;

        const pdfBuffer = await downloadPdfFromS3(s3Key);

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${contract.fileName || 'contract.pdf'}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'private, max-age=300', // Cache for 5 min
            },
        });
    } catch (error: any) {
        console.error('GET /api/contracts/[id]/preview error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to load PDF' },
            { status: 500 }
        );
    }
}
