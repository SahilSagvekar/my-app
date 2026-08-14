export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { contract as contractTable, contractSigner as contractSignerTable, client as clientTable, clientPortalAccess as clientPortalAccessTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getSignWellDocument, downloadSignWellPdf, mapSignWellStatus, mapSignWellSignerStatus } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: contractId } = await params;

    const contractRow = await db.query.contract.findFirst({
      where: eq(contractTable.id, contractId),
      with: {
        contractSigners: true,
      },
    });

    if (!contractRow) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const contract: any = { ...contractRow, signers: contractRow.contractSigners };

    if (contract.clientId) {
      const clientRow = await db.query.client.findFirst({
        where: eq(clientTable.id, contract.clientId),
        with: { clientPortalAccesses: true },
      });
      const client = clientRow ? { ...clientRow, portalAccess: clientRow.clientPortalAccesses?.[0] ?? null } : null;
      contract.client = client;
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
          await db.update(contractSignerTable).set({
            status: newSignerStatus,
            signedAt: newSignerStatus === 'SIGNED' ? new Date().toISOString() : dbSigner.signedAt,
            viewedAt: newSignerStatus === 'VIEWED' ? new Date().toISOString() : dbSigner.viewedAt,
            updatedAt: new Date().toISOString(),
          }).where(eq(contractSignerTable.id, dbSigner.id));
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

      await db.update(contractTable).set({
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        signedS3Key: key,
        updatedAt: new Date().toISOString(),
      }).where(eq(contractTable.id, contract.id));

      // Advance portal if pipeline client
      const client = (contract as any).client;
      if (client?.portalAccess) {
        const currentStatus = client.portalAccess.status;
        if (currentStatus === 'CONTRACT_PENDING' || currentStatus === 'ONBOARDING') {
          await db.update(clientPortalAccessTable).set({
            status: 'PAYMENT_PENDING',
            updatedAt: new Date().toISOString(),
          }).where(eq(clientPortalAccessTable.clientId, client.id));
        }
      }

    } else if (newStatus !== contract.status || anySignerUpdated) {
      // Just update the main status if it changed
      await db.update(contractTable).set({
        status: newStatus as any,
        updatedAt: new Date().toISOString(),
      }).where(eq(contractTable.id, contract.id));
    }

    return NextResponse.json({ success: true, newStatus });
  } catch (err: any) {
    console.error('POST /api/contracts/[id]/sync error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}
