export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { contract as contractTable, contractSigner as contractSignerTable, contractAuditLog as contractAuditLogTable, client as clientTable, clientPortalAccess as clientPortalAccessTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq } from 'drizzle-orm';
import { downloadSignWellPdf, mapSignWellStatus, mapSignWellSignerStatus } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';
import { notifyContractSigned } from '@/lib/pipeline-notifications';

/**
 * POST /api/webhooks/signwell
 *
 * Receives real-time event pushes from SignWell.
 * Configure this URL in the SignWell dashboard under:
 *   Settings → Webhooks → https://your-domain/api/webhooks/signwell
 *
 * Supported events:
 *   - document_completed
 *   - document_signed   (individual signer signed)
 *   - document_viewed
 *   - document_declined / document_voided / document_expired
 */
export async function POST(req: NextRequest) {
  try {
    // Optional webhook secret verification
    const secret = process.env.SIGNWELL_WEBHOOK_SECRET;
    if (secret) {
      const headerSecret = req.headers.get('x-signwell-secret') ||
                           req.headers.get('x-api-key');
      if (headerSecret !== secret) {
        console.warn('[signwell webhook] Invalid secret — rejecting');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();
    const event = body?.event || body?.type;
    const doc   = body?.data?.document || body?.document || body?.data;

    console.log(`[signwell webhook] event=${event} doc=${doc?.id}`);

    if (!doc?.id) {
      return NextResponse.json({ received: true }); // Ignore malformed payloads
    }

    // Find the contract linked to this SignWell document
    //
    // NOTE(prisma-migration): the original Prisma query here included a
    // `client: { include: { portalAccess: true } }` relation on Contract that
    // does not exist on the Contract model in prisma/schema.prisma (no `client`
    // field defined there) nor in the live-DB-introspected src/lib/db/schema.ts
    // (Contract.clientId has no FK/relation to Client). This was schema drift
    // that would have thrown a PrismaClientValidationError on every webhook
    // call. Converted to the same manual clientId -> Client lookup pattern used
    // by the sibling src/app/api/signwell/webhook/route.ts, which works.
    const found = await db.query.contract.findFirst({
      where: eq(contractTable.signwellDocumentId, doc.id),
      with: {
        contractSigners: true,
      },
    });

    if (!found) {
      console.warn(`[signwell webhook] No contract found for document ${doc.id}`);
      return NextResponse.json({ received: true });
    }

    const contract: any = { ...found, signers: found.contractSigners };
    if (contract.clientId) {
      const clientRow = await db.query.client.findFirst({
        where: eq(clientTable.id, contract.clientId),
        with: { clientPortalAccesses: true },
      });
      contract.client = clientRow
        ? { ...clientRow, portalAccess: clientRow.clientPortalAccesses?.[0] ?? null }
        : null;
    }

    // ── Update individual signer statuses ──────────────────────────────────────
    const swSigners: any[] = doc.recipients || doc.signers || [];
    for (const swSigner of swSigners) {
      const dbSigner = contract.signers.find(
        (s: any) => s.email?.toLowerCase() === swSigner.email?.toLowerCase()
      );
      if (!dbSigner) continue;

      const newStatus = mapSignWellSignerStatus(swSigner.status);
      if (dbSigner.status !== newStatus) {
        const ipAddress = swSigner.ip_address || swSigner.ip || null;
        const userAgent = swSigner.user_agent || null;

        await db.update(contractSignerTable).set({
          status: newStatus,
          signedAt:  newStatus === 'SIGNED'  ? new Date().toISOString() : dbSigner.signedAt  ?? undefined,
          viewedAt:  newStatus === 'VIEWED'  ? new Date().toISOString() : dbSigner.viewedAt  ?? undefined,
          declinedAt: newStatus === 'DECLINED' ? new Date().toISOString() : dbSigner.declinedAt ?? undefined,
          declineReason: newStatus === 'DECLINED' ? (swSigner.decline_reason || null) : dbSigner.declineReason ?? undefined,
          ipAddress,
          userAgent,
          updatedAt: new Date().toISOString(),
        }).where(eq(contractSignerTable.id, dbSigner.id));

        if (['VIEWED', 'SIGNED', 'DECLINED'].includes(newStatus)) {
          await db.insert(contractAuditLogTable).values({
            id: createId(),
            contractId: contract.id,
            action: newStatus.toLowerCase(),
            performedBy: `${dbSigner.name} <${dbSigner.email}>`,
            ipAddress,
            userAgent,
            details: newStatus === 'DECLINED' && swSigner.decline_reason
              ? JSON.stringify({ reason: swSigner.decline_reason })
              : null,
          });
        }

        console.log(`[signwell webhook] Signer ${swSigner.email} → ${newStatus}`);
      }
    }

    // ── Update overall contract status ─────────────────────────────────────────
    const newContractStatus = mapSignWellStatus(doc.status);

    if (newContractStatus === 'COMPLETED' && contract.status !== 'COMPLETED') {
      // Download and store the signed PDF
      try {
        const pdfBuffer = await downloadSignWellPdf(doc.id);
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

        // Advance portal access if applicable
        const portalAccess = (contract.client as any)?.portalAccess;
        if (portalAccess) {
          const cur = portalAccess.status;
          if (cur === 'CONTRACT_PENDING' || cur === 'ONBOARDING') {
            await db.update(clientPortalAccessTable).set({
              status: 'PAYMENT_PENDING',
              updatedAt: new Date().toISOString(),
            }).where(eq(clientPortalAccessTable.clientId, (contract.client as any).id));
          }
        }

        await db.insert(contractAuditLogTable).values({
          id: createId(),
          contractId: contract.id,
          action: 'completed',
          performedBy: 'system',
          details: JSON.stringify({ message: 'All signers have signed. Document completed via SignWell.' }),
        });

        await notifyContractSigned(contract.title);

        console.log(`[signwell webhook] Contract ${contract.id} marked COMPLETED, PDF saved to R2`);
      } catch (pdfErr) {
        console.error('[signwell webhook] Failed to download/store signed PDF:', pdfErr);
        // Still mark as completed even if PDF storage fails
        await db.update(contractTable).set({
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).where(eq(contractTable.id, contract.id));
      }
    } else if (newContractStatus !== contract.status) {
      await db.update(contractTable).set({
        status: newContractStatus as any,
        updatedAt: new Date().toISOString(),
      }).where(eq(contractTable.id, contract.id));
      console.log(`[signwell webhook] Contract ${contract.id} → ${newContractStatus}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[signwell webhook] Error:', err);
    // Always return 200 to prevent SignWell from retrying endlessly
    return NextResponse.json({ received: true, error: err.message });
  }
}
