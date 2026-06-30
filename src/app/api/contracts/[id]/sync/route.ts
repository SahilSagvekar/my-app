export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { getSignWellDocument, downloadSignWellPdf, mapSignWellStatus, mapSignWellSignerStatus } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: contractId } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        signers: true,
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    if (contract.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: contract.clientId },
        include: { portalAccess: true }
      });
      (contract as any).client = client;
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

    if (!contract.signwellDocumentId) {
      return NextResponse.json({ error: 'No SignWell document associated' }, { status: 400 });
    }

    const swDoc = await getSignWellDocument(contract.signwellDocumentId);
    
    // Check if overall status changed
    const newStatus = mapSignWellStatus(swDoc.status);
    
    // Update signer statuses
    const swSigners = swDoc.recipients || swDoc.signers || [];
    let anySignerUpdated = false;

    for (const swSigner of swSigners) {
      const dbSigner = (contract as any).signers.find(
        (s: any) => s.email?.toLowerCase() === swSigner.email?.toLowerCase()
      );

      if (dbSigner) {
        const newSignerStatus = mapSignWellSignerStatus(swSigner.status);
        if (dbSigner.status !== newSignerStatus) {
          await prisma.contractSigner.update({
            where: { id: dbSigner.id },
            data: { 
              status: newSignerStatus, 
              signedAt: newSignerStatus === 'SIGNED' ? new Date() : dbSigner.signedAt,
              viewedAt: newSignerStatus === 'VIEWED' ? new Date() : dbSigner.viewedAt,
            },
          });
          anySignerUpdated = true;
        }
      }
    }

    // Handle completed document
    if (newStatus === 'COMPLETED' && contract.status !== 'COMPLETED') {
      // Download signed PDF
      const pdfBuffer = await downloadSignWellPdf(swDoc.id);

      // Save to R2
      const clientName = (contract.client as any)?.companyName ||
                         (contract.client as any)?.name ||
                         'client';
      const { key } = await uploadBufferToS3({
        buffer: pdfBuffer,
        folderPrefix: `${clientName}/Contracts/`,
        filename: `signed-${contract.fileName || 'contract.pdf'}`,
        mimeType: 'application/pdf',
      });

      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          signedS3Key: key,
        },
      });
      
      // Advance portal if pipeline client
      const client = (contract as any).client;
      if (client?.portalAccess) {
        const currentStatus = client.portalAccess.status;
        if (currentStatus === 'CONTRACT_PENDING' || currentStatus === 'ONBOARDING') {
          await prisma.clientPortalAccess.update({
            where: { clientId: client.id },
            data: { status: 'PAYMENT_PENDING' },
          });
        }
      }
      
    } else if (newStatus !== contract.status || anySignerUpdated) {
      // Just update the main status if it changed
      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: newStatus as any },
      });
    }

    return NextResponse.json({ success: true, newStatus });
  } catch (err: any) {
    console.error('POST /api/contracts/[id]/sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
