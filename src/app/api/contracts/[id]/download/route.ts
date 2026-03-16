import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { downloadPdfFromS3, appendAuditTrailPage } from '@/lib/contracts';
import { PDFDocument } from 'pdf-lib';

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
                auditLogs: { orderBy: { createdAt: 'asc' } },
            },
        });

        if (!contract) {
            return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
        }

        const user = await prisma.user.findFirst({
            where: { id: jwtUser.userId || jwtUser.id },
            include: { client: true }
        });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Authorization check
        if (user.role === 'client') {
            const isOwner = contract.clientId === user.linkedClientId || (user.client && contract.clientId === user.client.id);
            const isSigner = contract.signers.some(s => s.email === user.email);
            if (!isOwner && !isSigner) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        } else if (user.role !== 'admin' && user.role !== 'manager') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');

        const s3Key = type === 'signed' && contract.signedS3Key
            ? contract.signedS3Key
            : contract.s3Key;

        // Fetch the buffer from S3
        let pdfBuffer = await downloadPdfFromS3(s3Key);

        // Append audit trail if the document is not the final signed version 
        // (The final signed version already contains the audit trail from applySignaturesToPdf)
        const isAlreadyFinalized = type === 'signed' && contract.signedS3Key;

        if (!isAlreadyFinalized && contract.auditLogs.length > 0) {
            try {
                const pdfDoc = await PDFDocument.load(pdfBuffer);
                await appendAuditTrailPage(pdfDoc, contract.auditLogs, contract.title, contract);
                const bytes = await pdfDoc.save();
                pdfBuffer = Buffer.from(bytes);
            } catch (appendErr) {
                console.error('Failed to append audit trail to download:', appendErr);
            }
        }

        // Return the bytes directly with correct headers for download
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${contract.fileName || 'contract.pdf'}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            },
        });

    } catch (error: any) {
        console.error('GET /api/contracts/[id]/download error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
