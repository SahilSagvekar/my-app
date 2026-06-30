export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { getS3, BUCKET } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { downloadSignWellPdf } from '@/lib/signwell';

// GET /api/contracts/[id]/download?type=signed|original
// Returns a download URL for the contract PDF
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: contractId } = await params;
    const type = req.nextUrl.searchParams.get('type') || 'signed';

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { signers: true },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Access check
    if (user.role === 'client') {
      const isSigner = (contract as any).signers.some((s: any) => s.email === user.email);
      const isClient = contract.clientId === user.linkedClientId;
      if (!isSigner && !isClient) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const s3Client = getS3();
    const safeTitle = (contract.title || 'contract').replace(/[^a-z0-9\-_ ]/gi, '_');

    // 1️⃣ Try to serve from R2 (signed S3 key stored on the contract)
    const s3Key = type === 'signed' ? contract.signedS3Key : contract.s3Key;

    if (s3Key) {
      const filename = type === 'signed'
        ? `signed-${safeTitle}.pdf`
        : `${safeTitle}.pdf`;

      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
        ResponseContentType: 'application/pdf',
      });

      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
      return NextResponse.json({ downloadUrl, filename });
    }

    // 2️⃣ Fallback: fetch from SignWell directly (for completed contracts without an S3 key)
    if (type === 'signed' && contract.status === 'COMPLETED' && contract.signwellDocumentId) {
      const pdfBuffer = await downloadSignWellPdf(contract.signwellDocumentId);
      const filename = `signed-${safeTitle}.pdf`;

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(pdfBuffer.length),
        },
      });
    }

    return NextResponse.json(
      { error: 'No downloadable PDF available for this contract' },
      { status: 404 }
    );
  } catch (err: any) {
    console.error('GET /api/contracts/[id]/download error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
