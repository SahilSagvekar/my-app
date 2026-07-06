export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadSignWellPdf, mapSignWellStatus, mapSignWellSignerStatus } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';
import nodemailer from 'nodemailer';

// POST /api/signwell/webhook
// Register this URL in SignWell: Settings → Webhooks
export async function POST(req: NextRequest) {
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
}

async function findContract(signwellDocId: string) {
  const contract = await prisma.contract.findFirst({
    where: {
      OR: [
        { signwellDocumentId: signwellDocId },
        { signwellRequestId: signwellDocId },
      ],
    },
    include: {
      signers: true,
    },
  });

  if (contract?.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: contract.clientId },
      include: { portalAccess: true },
    });
    (contract as any).client = client;
  }

  return contract;
}

async function handleCompleted(document: any) {
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

    // Update contract
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        signedS3Key: key,
        signers: {
          updateMany: {
            where: {},
            data: { status: 'SIGNED', signedAt: new Date() },
          },
        },
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
        console.log(`✅ [Portal] Advanced to PAYMENT_PENDING for ${client.name}`);
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

    // Notify admin
    await notifyAdmin(
      `✅ Contract signed — ${contract.title}`,
      `The contract "${contract.title}" has been fully signed by all parties. Signed PDF saved to R2.`
    );

    console.log(`✅ [SignWell] Contract completed: ${contract.id}`);
  } catch (err: any) {
    console.error(`[SignWell] Error handling completed doc:`, err);
  }
}

async function handleSignerSigned(document: any) {
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

        await prisma.contractSigner.update({
          where: { id: dbSigner.id },
          data: { status: 'SIGNED', signedAt: new Date(), ipAddress, userAgent },
        });

        await prisma.contractAuditLog.create({
          data: {
            contractId: contract.id,
            action: 'signed',
            performedBy: `${dbSigner.name} <${dbSigner.email}>`,
            ipAddress,
            userAgent,
          },
        });
      }
    }
  }

  // Check if all signed → mark as PARTIALLY_SIGNED or keep SENT
  const allSigned = contract.signers.every((s: any) => s.status === 'SIGNED');
  if (!allSigned && contract.status === 'SENT') {
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'PARTIALLY_SIGNED' },
    });
  }

  console.log(`✍️ [SignWell] Signer signed on contract: ${contract.id}`);
}

async function handleDeclined(document: any) {
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
    await prisma.contractSigner.update({
      where: { id: dbSigner.id },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
        declineReason: decliner?.decline_reason || null,
        ipAddress,
        userAgent,
      },
    });
  }

  await prisma.contract.update({
    where: { id: contract.id },
    data: { status: 'CANCELLED' },
  });

  await prisma.contractAuditLog.create({
    data: {
      contractId: contract.id,
      action: 'declined',
      performedBy: dbSigner ? `${dbSigner.name} <${dbSigner.email}>` : 'unknown signer',
      ipAddress,
      userAgent,
      details: decliner?.decline_reason ? JSON.stringify({ reason: decliner.decline_reason }) : null,
    },
  });

  await notifyAdmin(
    `❌ Contract declined — ${contract.title}`,
    `A signer has declined to sign "${contract.title}". The contract has been cancelled.`
  );

  console.log(`❌ [SignWell] Contract declined: ${contract.id}`);
}

async function handleViewed(document: any) {
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

        await prisma.contractSigner.update({
          where: { id: dbSigner.id },
          data: { status: 'VIEWED', viewedAt: new Date(), ipAddress, userAgent },
        });

        await prisma.contractAuditLog.create({
          data: {
            contractId: contract.id,
            action: 'viewed',
            performedBy: `${dbSigner.name} <${dbSigner.email}>`,
            ipAddress,
            userAgent,
          },
        });
      }
    }
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