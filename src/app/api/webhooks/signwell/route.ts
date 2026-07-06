export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadSignWellPdf, mapSignWellStatus, mapSignWellSignerStatus } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';

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
    const contract = await prisma.contract.findFirst({
      where: { signwellDocumentId: doc.id },
      include: {
        signers: true,
        client: { include: { portalAccess: true } },
      },
    });

    if (!contract) {
      console.warn(`[signwell webhook] No contract found for document ${doc.id}`);
      return NextResponse.json({ received: true });
    }

    // ── Update individual signer statuses ──────────────────────────────────────
    const swSigners: any[] = doc.recipients || doc.signers || [];
    for (const swSigner of swSigners) {
      const dbSigner = contract.signers.find(
        (s) => s.email?.toLowerCase() === swSigner.email?.toLowerCase()
      );
      if (!dbSigner) continue;

      const newStatus = mapSignWellSignerStatus(swSigner.status);
      if (dbSigner.status !== newStatus) {
        const ipAddress = swSigner.ip_address || swSigner.ip || null;
        const userAgent = swSigner.user_agent || null;

        await prisma.contractSigner.update({
          where: { id: dbSigner.id },
          data: {
            status: newStatus,
            signedAt:  newStatus === 'SIGNED'  ? new Date() : dbSigner.signedAt  ?? undefined,
            viewedAt:  newStatus === 'VIEWED'  ? new Date() : dbSigner.viewedAt  ?? undefined,
            declinedAt: newStatus === 'DECLINED' ? new Date() : dbSigner.declinedAt ?? undefined,
            declineReason: newStatus === 'DECLINED' ? (swSigner.decline_reason || null) : dbSigner.declineReason ?? undefined,
            ipAddress,
            userAgent,
          },
        });

        if (['VIEWED', 'SIGNED', 'DECLINED'].includes(newStatus)) {
          await prisma.contractAuditLog.create({
            data: {
              contractId: contract.id,
              action: newStatus.toLowerCase(),
              performedBy: `${dbSigner.name} <${dbSigner.email}>`,
              ipAddress,
              userAgent,
              details: newStatus === 'DECLINED' && swSigner.decline_reason
                ? JSON.stringify({ reason: swSigner.decline_reason })
                : null,
            },
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

        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            signedS3Key: key,
          },
        });

        // Advance portal access if applicable
        const portalAccess = (contract.client as any)?.portalAccess;
        if (portalAccess) {
          const cur = portalAccess.status;
          if (cur === 'CONTRACT_PENDING' || cur === 'ONBOARDING') {
            await prisma.clientPortalAccess.update({
              where: { clientId: (contract.client as any).id },
              data: { status: 'PAYMENT_PENDING' },
            });
          }
        }

        await prisma.contractAuditLog.create({
          data: {
            contractId: contract.id,
            action: 'completed',
            performedBy: 'system',
            details: JSON.stringify({ message: 'All signers have signed. Document completed via SignWell.' }),
          },
        });

        console.log(`[signwell webhook] Contract ${contract.id} marked COMPLETED, PDF saved to R2`);
      } catch (pdfErr) {
        console.error('[signwell webhook] Failed to download/store signed PDF:', pdfErr);
        // Still mark as completed even if PDF storage fails
        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }
    } else if (newContractStatus !== contract.status) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: { status: newContractStatus as any },
      });
      console.log(`[signwell webhook] Contract ${contract.id} → ${newContractStatus}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[signwell webhook] Error:', err);
    // Always return 200 to prevent SignWell from retrying endlessly
    return NextResponse.json({ received: true, error: err.message });
  }
}
