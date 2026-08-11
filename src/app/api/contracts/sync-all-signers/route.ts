export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contract as contractTable, contractSigner as contractSignerTable, client as clientTable } from '@/lib/db/schema';
import { and, eq, isNotNull, inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getSignWellDocument, mapSignWellStatus, mapSignWellSignerStatus, downloadSignWellPdf } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';

/**
 * POST /api/contracts/sync-all-signers
 *
 * Admin-only: Re-syncs signer statuses for ALL contracts that have any
 * signer still in PENDING state, regardless of the contract's own status.
 * Use this as a one-time fix for contracts that were completed in SignWell
 * but whose signers are still showing as PENDING in the database.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find ALL contracts with at least one PENDING signer and a SignWell doc ID
    //
    // NOTE(prisma-migration): the original Prisma query here included a
    // `client: { include: { portalAccess: true } }` relation on Contract that
    // does not exist on the Contract model in prisma/schema.prisma (no `client`
    // field is defined there, and the live-DB-introspected src/lib/db/schema.ts
    // confirms Contract.clientId has no FK/relation to Client). That include
    // was schema drift and would have made this endpoint always throw a
    // PrismaClientValidationError before ever reaching the sync loop below.
    // Converted to the same manual clientId -> Client lookup pattern used by
    // the sibling contracts/sync and contracts/[id]/sync routes, which is the
    // pattern that actually works elsewhere in this feature.
    const pendingSignerRows = await db
      .selectDistinct({ contractId: contractSignerTable.contractId })
      .from(contractSignerTable)
      .where(eq(contractSignerTable.status, 'PENDING'));
    const pendingSignerContractIds = pendingSignerRows.map((r) => r.contractId);

    const rows = pendingSignerContractIds.length > 0
      ? await db.query.contract.findMany({
          where: and(isNotNull(contractTable.signwellDocumentId), inArray(contractTable.id, pendingSignerContractIds)),
          with: { contractSigners: true },
        })
      : [];

    const contracts: any[] = [];
    for (const c of rows) {
      let client: any = null;
      if (c.clientId) {
        const clientRow = await db.query.client.findFirst({
          where: eq(clientTable.id, c.clientId),
          with: { clientPortalAccesses: true },
        });
        client = clientRow ? { ...clientRow, portalAccess: clientRow.clientPortalAccesses?.[0] ?? null } : null;
      }
      contracts.push({ ...c, signers: c.contractSigners, client });
    }

    console.log(`[sync-all-signers] Found ${contracts.length} contract(s) with pending signers`);

    let contractsFixed = 0;
    let signersFixed = 0;
    const errors: string[] = [];

    for (const contract of contracts) {
      try {
        const swDoc = await getSignWellDocument(contract.signwellDocumentId!);
        const swSigners: any[] = swDoc.recipients || swDoc.signers || [];
        let anyUpdated = false;

        for (const swSigner of swSigners) {
          const dbSigner = contract.signers.find(
            (s) => s.email?.toLowerCase() === swSigner.email?.toLowerCase()
          );
          if (!dbSigner) continue;

          const newStatus = mapSignWellSignerStatus(swSigner.status);
          if (dbSigner.status !== newStatus) {
            await db.update(contractSignerTable).set({
              status: newStatus,
              signedAt: newStatus === 'SIGNED' ? new Date().toISOString() : dbSigner.signedAt ?? undefined,
              viewedAt: newStatus === 'VIEWED' ? new Date().toISOString() : dbSigner.viewedAt ?? undefined,
              updatedAt: new Date().toISOString(),
            }).where(eq(contractSignerTable.id, dbSigner.id));
            signersFixed++;
            anyUpdated = true;
            console.log(`  ✔ ${contract.title}: signer ${swSigner.email} ${dbSigner.status} → ${newStatus}`);
          }
        }

        // Also fix the contract-level status
        const newContractStatus = mapSignWellStatus(swDoc.status);
        if (newContractStatus !== contract.status) {
          if (newContractStatus === 'COMPLETED' && contract.status !== 'COMPLETED') {
            try {
              const pdfBuffer = await downloadSignWellPdf(swDoc.id);
              const clientName =
                (contract.client as any)?.companyName ||
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
            } catch {
              await db.update(contractTable).set({
                status: 'COMPLETED',
                completedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }).where(eq(contractTable.id, contract.id));
            }
          } else {
            await db.update(contractTable).set({
              status: newContractStatus as any,
              updatedAt: new Date().toISOString(),
            }).where(eq(contractTable.id, contract.id));
          }
          anyUpdated = true;
        }

        if (anyUpdated) contractsFixed++;
      } catch (err: any) {
        const msg = `Contract ${contract.id} (${contract.title}): ${err.message}`;
        console.error('  ✖', msg);
        errors.push(msg);
      }
    }

    return NextResponse.json({
      success: true,
      contractsChecked: contracts.length,
      contractsFixed,
      signersFixed,
      errors,
    });
  } catch (err: any) {
    console.error('[sync-all-signers] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
