// src/app/api/contracts/[id]/preview/route.ts
// Proxy PDF from S3 to avoid cross-origin iframe blocking
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { downloadPdfFromS3, appendAuditTrailPage } from '@/lib/contracts';
import { PDFDocument } from 'pdf-lib';

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
            include: {
                auditLogs: { orderBy: { createdAt: 'asc' } },
                signers: { select: { email: true } },
            }
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

        const s3Key = type === 'signed' && contract.signedS3Key
            ? contract.signedS3Key
            : contract.s3Key;

        let pdfBuffer: Buffer = await downloadPdfFromS3(s3Key);

        // Dynamically append audit trail for preview if it's not already the finalized signed version
        // (The signed version already has it appended during finalization)
        if (type !== 'signed' && contract.auditLogs.length > 0) {
            try {
                const pdfDoc = await PDFDocument.load(pdfBuffer);
                await appendAuditTrailPage(pdfDoc, contract.auditLogs, contract.title, contract);
                const bytes = await pdfDoc.save();
                pdfBuffer = Buffer.from(bytes);
            } catch (appendErr) {
                console.error('Failed to append audit trail to preview:', appendErr);
                // Continue with original buffer if appending fails
            }
        }

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${contract.fileName || 'contract.pdf'}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
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
