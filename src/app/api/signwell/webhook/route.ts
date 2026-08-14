export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { contract as contractTable, contractSigner as contractSignerTable, contractAuditLog as contractAuditLogTable, client as clientTable, clientPortalAccess as clientPortalAccessTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, or } from 'drizzle-orm';
import { downloadSignWellPdf, mapSignWellStatus, mapSignWellSignerStatus } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';
import nodemailer from 'nodemailer';
import { notifyContractSigned } from '@/lib/pipeline-notifications';

// POST /api/signwell/webhook
// Register this URL in SignWell: Settings → Webhooks
export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const body = await req.json();
    const eventType: string = body.event_type || body.type || '';
    const document = body.document || body.data?.document || body;

    console.log(`📩 [SignWell Webhook] Event: ${eventType} | Doc: ${document?.id}`);

    switch (eventType) {
      case 'document_completed':
      case 'document.completed':
        await handleCompleted(document);
        break;
      case 'document_signed':
      case 'document.signed':
        await handleSignerSigned(document);
        break;
      case 'document_declined':
      case 'document.declined':
        await handleDeclined(document);
        break;
      case 'document_viewed':
      case 'document.viewed':
        await handleViewed(document);
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[SignWell Webhook] Error:', err);
    // Always 200 so SignWell doesn't retry
    return NextResponse.json({ received: true, error: err.message });
  }

  } finally {
    await closeDb();
  }
}

async function findContract(signwellDocId: string) {
  const { db, closeDb } = getDb();
  try {
  const found = await db.query.contract.findFirst({
    where: or(
      eq(contractTable.signwellDocumentId, signwellDocId),
      eq(contractTable.signwellRequestId, signwellDocId)
    ),
    with: {
      contractSigners: true,
    },
  });

  if (!found) return null;

  const contract: any = { ...found, signers: found.contractSigners };

  if (contract.clientId) {
    const clientRow = await db.query.client.findFirst({
      where: eq(clientTable.id, contract.clientId),
      with: { clientPortalAccesses: true },
    });
    const client = clientRow ? { ...clientRow, portalAccess: clientRow.clientPortalAccesses?.[0] ?? null } : null;
    contract.client = client;
  }

  return contract;

  } finally {
    await closeDb();
  }
}

async function handleCompleted(document: any) {
  const { db, closeDb } = getDb();
  try {
  const contract = await findContract(document.id) as any;
  if (!contract) {
    console.warn(`[SignWell] No contract found for doc: ${document.id}`);
    return;
  }

  try {
    // Download signed PDF
    const pdfBuffer = await downloadSignWellPdf(document.id);

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

    // Update contract + mark all its signers SIGNED (was a single Prisma nested
    // write, atomic by default — wrapped in a transaction to preserve that)
    await db.transaction(async (tx) => {
      await tx.update(contractTable).set({
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
        signedS3Key: key,
        updatedAt: new Date().toISOString(),
      }).where(eq(contractTable.id, contract.id));

      await tx.update(contractSignerTable).set({
        status: 'SIGNED',
        signedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(contractSignerTable.contractId, contract.id));
    });

    // Advance portal if pipeline client
    const client = (contract as any).client;
    if (client?.portalAccess) {
      const currentStatus = client.portalAccess.status;
      if (currentStatus === 'CONTRACT_PENDING' || currentStatus === 'ONBOARDING') {
        await db.update(clientPortalAccessTable).set({
          status: 'PAYMENT_PENDING',
          updatedAt: new Date().toISOString(),
        }).where(eq(clientPortalAccessTable.clientId, client.id));
        console.log(`✅ [Portal] Advanced to PAYMENT_PENDING for ${client.name}`);
      }
    }

    await db.insert(contractAuditLogTable).values({
      id: createId(),
      contractId: contract.id,
      action: 'completed',
      performedBy: 'system',
      details: JSON.stringify({ message: 'All signers have signed. Document completed via SignWell.' }),
    });

    // Notify pipeline recipients (Slack DM + email)
    await notifyContractSigned(contract.title);

    console.log(`✅ [SignWell] Contract completed: ${contract.id}`);
  } catch (err: any) {
    console.error(`[SignWell] Error handling completed doc:`, err);
  }

  } finally {
    await closeDb();
  }
}

async function handleSignerSigned(document: any) {
  const { db, closeDb } = getDb();
  try {
  const contract = await findContract(document.id) as any;
  if (!contract) return;

  // Update the individual signer status
  const signwellSigners: any[] = document.signers || [];
  for (const swSigner of signwellSigners) {
    if (swSigner.status === 'signed' || swSigner.status === 'completed') {
      // Find matching signer by email
      const dbSigner = contract.signers.find(
        (s: any) => s.email?.toLowerCase() === swSigner.email?.toLowerCase()
      );
      if (dbSigner && dbSigner.status !== 'SIGNED') {
        const ipAddress = swSigner.ip_address || swSigner.ip || null;
        const userAgent = swSigner.user_agent || null;

        await db.update(contractSignerTable).set({
          status: 'SIGNED',
          signedAt: new Date().toISOString(),
          ipAddress,
          userAgent,
          updatedAt: new Date().toISOString(),
        }).where(eq(contractSignerTable.id, dbSigner.id));

        await db.insert(contractAuditLogTable).values({
          id: createId(),
          contractId: contract.id,
          action: 'signed',
          performedBy: `${dbSigner.name} <${dbSigner.email}>`,
          ipAddress,
          userAgent,
        });
      }
    }
  }

  // Check if all signed → mark as PARTIALLY_SIGNED or keep SENT
  const allSigned = contract.signers.every((s: any) => s.status === 'SIGNED');
  if (!allSigned && contract.status === 'SENT') {
    await db.update(contractTable).set({
      status: 'PARTIALLY_SIGNED',
      updatedAt: new Date().toISOString(),
    }).where(eq(contractTable.id, contract.id));
  }

  console.log(`✍️ [SignWell] Signer signed on contract: ${contract.id}`);

  } finally {
    await closeDb();
  }
}

async function handleDeclined(document: any) {
  const { db, closeDb } = getDb();
  try {
  const contract = await findContract(document.id) as any;
  if (!contract) return;

  const signwellSigners: any[] = document.signers || [];
  const decliner = signwellSigners.find((s) => s.status === 'declined');
  const dbSigner = decliner && contract.signers.find(
    (s: any) => s.email?.toLowerCase() === decliner.email?.toLowerCase()
  );
  const ipAddress = decliner?.ip_address || decliner?.ip || null;
  const userAgent = decliner?.user_agent || null;

  if (dbSigner) {
    await db.update(contractSignerTable).set({
      status: 'DECLINED',
      declinedAt: new Date().toISOString(),
      declineReason: decliner?.decline_reason || null,
      ipAddress,
      userAgent,
      updatedAt: new Date().toISOString(),
    }).where(eq(contractSignerTable.id, dbSigner.id));
  }

  await db.update(contractTable).set({
    status: 'CANCELLED',
    updatedAt: new Date().toISOString(),
  }).where(eq(contractTable.id, contract.id));

  await db.insert(contractAuditLogTable).values({
    id: createId(),
    contractId: contract.id,
    action: 'declined',
    performedBy: dbSigner ? `${dbSigner.name} <${dbSigner.email}>` : 'unknown signer',
    ipAddress,
    userAgent,
    details: decliner?.decline_reason ? JSON.stringify({ reason: decliner.decline_reason }) : null,
  });

  await notifyAdmin(
    `❌ Contract declined — ${contract.title}`,
    `A signer has declined to sign "${contract.title}". The contract has been cancelled.`
  );

  console.log(`❌ [SignWell] Contract declined: ${contract.id}`);

  } finally {
    await closeDb();
  }
}

async function handleViewed(document: any) {
  const { db, closeDb } = getDb();
  try {
  const contract = await findContract(document.id) as any;
  if (!contract) return;

  // Update signer status to VIEWED
  const signwellSigners: any[] = document.signers || [];
  for (const swSigner of signwellSigners) {
    if (swSigner.status === 'viewed') {
      const dbSigner = contract.signers.find(
        (s: any) => s.email?.toLowerCase() === swSigner.email?.toLowerCase()
      );
      if (dbSigner && dbSigner.status === 'PENDING') {
        const ipAddress = swSigner.ip_address || swSigner.ip || null;
        const userAgent = swSigner.user_agent || null;

        await db.update(contractSignerTable).set({
          status: 'VIEWED',
          viewedAt: new Date().toISOString(),
          ipAddress,
          userAgent,
          updatedAt: new Date().toISOString(),
        }).where(eq(contractSignerTable.id, dbSigner.id));

        await db.insert(contractAuditLogTable).values({
          id: createId(),
          contractId: contract.id,
          action: 'viewed',
          performedBy: `${dbSigner.name} <${dbSigner.email}>`,
          ipAddress,
          userAgent,
        });
      }
    }
  }

  } finally {
    await closeDb();
  }
}

async function notifyAdmin(subject: string, body: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transporter.sendMail({
    from: `"E8 App" <${process.env.SMTP_USER}>`,
    to: 'eric@e8productions.com',
    subject,
    html: `<p>${body}</p>`,
  }).catch(console.error);
}