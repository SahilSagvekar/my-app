export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { downloadSignWellPdf } from '@/lib/signwell';
import { uploadBufferToS3 } from '@/lib/s3';
import nodemailer from 'nodemailer';

// POST /api/signwell/webhook
// SignWell sends events here when documents are signed/completed/declined
// Configure in SignWell dashboard: Settings → Webhooks → Add endpoint
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret if configured
    const secret = process.env.SIGNWELL_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers.get('x-signwell-signature');
      if (sig !== secret) {
        console.warn('[SignWell Webhook] Invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body = await req.json();
    const eventType: string = body.event_type || body.type || '';
    const document = body.document || body.data?.document || body;

    console.log(`📩 [SignWell Webhook] Event: ${eventType} | Doc: ${document?.id}`);

    if (eventType === 'document_completed' || eventType === 'document.completed') {
      await handleDocumentCompleted(document);
    } else if (eventType === 'document_declined' || eventType === 'document.declined') {
      await handleDocumentDeclined(document);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[SignWell Webhook] Error:', err);
    // Always return 200 to SignWell so it doesn't retry infinitely
    return NextResponse.json({ received: true, error: err.message });
  }
}

async function handleDocumentCompleted(document: any) {
  const signwellDocId: string = document.id;
  if (!signwellDocId) return;

  // Find the contract record by signwell ID
  const contract = await prisma.contract.findFirst({
    where: {
      OR: [
        { signwellRequestId: signwellDocId },
        { signwellDocumentId: signwellDocId },
      ],
    },
    include: {
      client: {
        include: { portalAccess: true },
      },
    } as any,
  });

  if (!contract) {
    console.warn(`[SignWell Webhook] No contract found for doc: ${signwellDocId}`);
    return;
  }

  const client = (contract as any).client;

  try {
    // 1. Download signed PDF from SignWell
    const pdfBuffer = await downloadSignWellPdf(signwellDocId);

    // 2. Upload to R2 under client's Contracts folder
    const safeName = (client.companyName || client.name)
      .toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filename = `signed-contract-${Date.now()}.pdf`;
    const folderPrefix = `${client.companyName || client.name}/Contracts/`;

    const { key, url } = await uploadBufferToS3({
      buffer: pdfBuffer,
      folderPrefix,
      filename,
      mimeType: 'application/pdf',
    });

    // 3. Update contract record
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        signedS3Key: key,
      },
    });

    // 4. Advance portal to PAYMENT_PENDING
    if (client?.portalAccess) {
      await prisma.clientPortalAccess.update({
        where: { clientId: client.id },
        data: { status: 'PAYMENT_PENDING' },
      });
    }

    // 5. Update client portalPasswordSet flag (confirm contract signed)
    await prisma.client.update({
      where: { id: client.id },
      data: { status: 'active' },
    });

    console.log(`✅ [SignWell] Contract completed for ${client.name} | PDF saved: ${key}`);

    // 6. Send notification to admin
    await sendContractSignedAdminNotification(client.name, client.email);

  } catch (err: any) {
    console.error(`[SignWell] Error processing completed doc ${signwellDocId}:`, err);
  }
}

async function handleDocumentDeclined(document: any) {
  const signwellDocId: string = document.id;
  if (!signwellDocId) return;

  const contract = await prisma.contract.findFirst({
    where: {
      OR: [
        { signwellRequestId: signwellDocId },
        { signwellDocumentId: signwellDocId },
      ],
    },
  });

  if (contract) {
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    console.log(`⚠️ [SignWell] Document declined for contract: ${contract.id}`);
  }
}

async function sendContractSignedAdminNotification(clientName: string, clientEmail: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: 'eric@e8productions.com',
    subject: `✅ Contract signed — ${clientName}`,
    html: `
      <p><strong>${clientName}</strong> (${clientEmail}) has signed their service agreement.</p>
      <p>Their portal is now in <strong>PAYMENT_PENDING</strong> state —
         they need to complete their first payment to unlock full access.</p>
      <p>The signed PDF has been saved to their R2 folder under <code>Contracts/</code>.</p>
    `,
  }).catch(console.error);
}
