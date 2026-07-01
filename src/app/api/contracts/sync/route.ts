export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { getSignWellDocument, downloadSignWellPdf, mapSignWellStatus, mapSignWellSignerStatus } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';

// GET /api/contracts/sync — Manually sync pending contracts with SignWell
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager', 'client'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find contracts that need syncing:
    // 1. Active contracts (SENT / PARTIALLY_SIGNED)
    // 2. COMPLETED contracts that still have PENDING signers — the most common
    //    cause of signers showing as "pending" even after everyone has signed.
    let where: any = {
      signwellDocumentId: { not: null },
    };

    if (user.role === 'client') {
      where.OR = [
        {
          clientId: user.linkedClientId,
          status: { in: ['SENT', 'PARTIALLY_SIGNED'] }
        },
        {
          clientId: user.linkedClientId,
          status: 'COMPLETED',
          signers: { some: { status: 'PENDING' } }
        },
        {
          signers: { some: { email: user.email } },
          status: { in: ['SENT', 'PARTIALLY_SIGNED'] }
        },
        {
          signers: { some: { email: user.email } },
          status: 'COMPLETED',
          signers: { some: { status: 'PENDING' } }
        }
      ];
    } else {
      where.OR = [
        { status: { in: ['SENT', 'PARTIALLY_SIGNED'] } },
        {
          status: 'COMPLETED',
          signers: { some: { status: 'PENDING' } },
        },
      ];
    }

    const pendingContracts = await prisma.contract.findMany({
      where,
      include: {
        signers: true,
      },
    });

    for (let contract of pendingContracts) {
      if (contract.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: contract.clientId },
          include: { portalAccess: true }
        });
        (contract as any).client = client;
      }
    }

    let syncedCount = 0;

    for (const contract of pendingContracts) {
      if (!contract.signwellDocumentId) continue;

      try {
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
          
          syncedCount++;
        } else if (newStatus !== contract.status || anySignerUpdated) {
          // Just update the main status if it changed
          await prisma.contract.update({
            where: { id: contract.id },
            data: { status: newStatus as any },
          });
          syncedCount++;
        }
      } catch (err) {
        console.error(`Failed to sync contract ${contract.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, syncedCount });
  } catch (err: any) {
    console.error('GET /api/contracts/sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
