// src/app/api/contracts/sign/[token]/preview/route.ts
// Public PDF preview proxy for the signing page (no auth required, token-based)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadPdfFromS3 } from '@/lib/contracts';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;

        // Find the contract through the signer's sign token
        const contract = await prisma.contract.findFirst({
            where: {
                signers: {
                    some: { signToken: token },
                },
            },
            select: { s3Key: true, fileName: true, status: true },
        });

        if (!contract) {
            return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
        }

        if (contract.status === 'CANCELLED' || contract.status === 'EXPIRED') {
            return NextResponse.json({ error: 'Contract is no longer active' }, { status: 400 });
        }

        const pdfBuffer = await downloadPdfFromS3(contract.s3Key);

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${contract.fileName || 'contract.pdf'}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'private, max-age=300',
            },
        });
    } catch (error: any) {
        console.error('GET /api/contracts/sign/[token]/preview error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to load PDF' },
            { status: 500 }
        );
    }
}

