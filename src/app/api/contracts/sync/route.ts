export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { contract as contractTable, contractSigner as contractSignerTable, client as clientTable, clientPortalAccess as clientPortalAccessTable } from '@/lib/db/schema';
import { and, or, eq, isNotNull, isNull, inArray, sql } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getSignWellDocument, downloadSignWellPdf, mapSignWellStatus, mapSignWellSignerStatus } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';

// GET /api/contracts/sync — Manually sync pending contracts with SignWell
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager', 'client'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find contracts that need syncing:
    // 1. Active contracts (SENT / PARTIALLY_SIGNED)
    // 2. COMPLETED contracts that still have PENDING signers — the most common
    //    cause of signers showing as "pending" even after everyone has signed.

    // Pre-compute the sets of contract IDs needed for the "some signer..." relation
    // filters below (Drizzle has no direct equivalent of Prisma's `some`).
    const pendingSignerRows = await db
      .selectDistinct({ contractId: contractSignerTable.contractId })
      .from(contractSignerTable)
      .where(eq(contractSignerTable.status, 'PENDING'));
    const pendingSignerContractIds = pendingSignerRows.map((r) => r.contractId);
    const hasPendingSigner = pendingSignerContractIds.length > 0
      ? inArray(contractTable.id, pendingSignerContractIds)
      : sql`false`;

    let orParts: any[];

    if (user.role === 'client') {
      const clientIdCond = user.linkedClientId == null
        ? isNull(contractTable.clientId)
        : eq(contractTable.clientId, user.linkedClientId);

      const myEmailSignerRows = await db
        .selectDistinct({ contractId: contractSignerTable.contractId })
        .from(contractSignerTable)
        .where(eq(contractSignerTable.email, user.email));
      const myEmailContractIds = myEmailSignerRows.map((r) => r.contractId);
      const isMySigner = myEmailContractIds.length > 0
        ? inArray(contractTable.id, myEmailContractIds)
        : sql`false`;

      orParts = [
        and(clientIdCond, inArray(contractTable.status, ['SENT', 'PARTIALLY_SIGNED'])),
        and(clientIdCond, eq(contractTable.status, 'COMPLETED'), hasPendingSigner),
        and(isMySigner, inArray(contractTable.status, ['SENT', 'PARTIALLY_SIGNED'])),
        and(eq(contractTable.status, 'COMPLETED'), isMySigner, hasPendingSigner),
      ];
    } else {
      orParts = [
        inArray(contractTable.status, ['SENT', 'PARTIALLY_SIGNED']),
        and(eq(contractTable.status, 'COMPLETED'), hasPendingSigner),
      ];
    }

    const rows = await db.query.contract.findMany({
      where: and(isNotNull(contractTable.signwellDocumentId), or(...orParts)),
      with: {
        contractSigners: true,
      },
    });

    const pendingContracts: any[] = rows.map((c) => ({ ...c, signers: c.contractSigners }));

    for (const contract of pendingContracts) {
      if (contract.clientId) {
        const clientRow = await db.query.client.findFirst({
          where: eq(clientTable.id, contract.clientId),
          with: { clientPortalAccesses: true },
        });
        const client = clientRow ? { ...clientRow, portalAccess: clientRow.clientPortalAccesses?.[0] ?? null } : null;
        contract.client = client;
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

          syncedCount++;
        } else if (newStatus !== contract.status || anySignerUpdated) {
          // Just update the main status if it changed
          await db.update(contractTable).set({
            status: newStatus as any,
            updatedAt: new Date().toISOString(),
          }).where(eq(contractTable.id, contract.id));
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
