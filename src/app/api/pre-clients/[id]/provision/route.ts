export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { createClientFolders } from '@/lib/s3';
import { createClientSlackChannel } from '@/lib/client-onboarding';
import nodemailer from 'nodemailer';
import { createRecurringTasksForClient } from '@/app/api/clients/recurring';
import { generateQuotePdf } from '@/lib/quote-pdf';
import { generateContractPdf, generateScheduleDocsPdf, mergePdfBuffers } from '@/lib/contract-pdf';
import { sendContractViaSignWell } from '@/lib/contracts';

function getTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Portal setup email — magic link + accepted quote PDF attached. The combined
// Quote + Schedules A/B + PSA document is sent separately by SignWell itself
// for signing (see sendContractViaSignWell in the provision handler below).
async function sendMagicLinkEmail(params: {
  clientName: string;
  email: string;
  magicLink: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: params.email,
    subject: `Welcome to E8 Productions — Set up your portal`,
    attachments: params.attachments || [],
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                  max-width: 560px; margin: 0 auto; padding: 40px 20px; color: #333;">
        <div style="border-bottom: 3px solid #0066ff; padding-bottom: 16px; margin-bottom: 28px;">
          <div style="font-size: 22px; font-weight: 700; color: #000;">E8 Productions</div>
          <div style="font-size: 12px; color: #666; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px;">
            Full Service Video + Content
          </div>
        </div>
        <p style="font-size: 16px;">Hi ${params.clientName},</p>
        <p style="font-size: 15px; line-height: 1.7; color: #444;">
          Your proposal has been accepted — your accepted quote is attached below
          for your records. Your E8 client portal is ready — click the button
          below to get started. You'll watch a quick welcome video, set your
          password, and sign your Professional Services Agreement (sent
          separately for signature) all at once.
        </p>
        <div style="text-align: center; margin: 36px 0;">
          <a href="${params.magicLink}"
             style="background: #0066ff; color: #fff; padding: 16px 36px;
                    border-radius: 8px; text-decoration: none; font-size: 16px;
                    font-weight: 700; display: inline-block; letter-spacing: 0.01em;">
            Access Your Portal →
          </a>
        </div>
        <p style="font-size: 13px; color: #888; text-align: center;">
          This link is one-time use and expires in 48 hours.<br/>
          If you didn't expect this email, please ignore it.
        </p>
        <div style="border-top: 1px solid #eee; margin-top: 36px; padding-top: 16px;">
          <p style="font-size: 12px; color: #aaa; margin: 0;">
            E8 Productions, LLC ·
            <a href="https://e8productions.com" style="color: #0066ff;">e8productions.com</a>
          </p>
        </div>
      </div>
    `,
  });
}

async function notifyAdminContractFailed(clientName: string, clientEmail: string, errorMessage: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"E8 Productions" <${process.env.SMTP_USER}>`,
      to: 'eric@e8productions.com',
      subject: `⚠️ Contract auto-generation failed — ${clientName}`,
      html: `<p>Automatic contract generation/send failed for <strong>${clientName}</strong> (${clientEmail}) during provisioning.</p><p>Error: ${errorMessage}</p><p>Please create and send the contract manually via the Contracts tab.</p>`,
    });
  } catch (err) {
    console.error('[Provision] Failed to send contract-failure admin notification:', err);
  }
}

// POST /api/pre-clients/[id]/provision
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preClientId } = await params;

    const preClient = await prisma.preClient.findUnique({
      where: { id: preClientId },
      include: {
        quotes: {
          where: { status: 'ACCEPTED' },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!preClient) {
      return NextResponse.json({ error: 'Pre-client not found' }, { status: 404 });
    }

    if (preClient.status === 'CONVERTED') {
      return NextResponse.json({ error: 'Already provisioned' }, { status: 400 });
    }

    if (preClient.status !== 'QUOTE_ACCEPTED') {
      return NextResponse.json(
        { error: 'Quote must be accepted before provisioning' },
        { status: 400 }
      );
    }

    // Check if a client with this email already exists (idempotency)
    const existingClient = await prisma.client.findFirst({
      where: { email: preClient.email },
    });
    if (existingClient) {
      return NextResponse.json({ error: 'A client with this email already exists' }, { status: 400 });
    }

    // Atomically claim this pre-client for provisioning. The two checks
    // above are plain reads and can't stop a double-click (or two admins
    // clicking at once) from both passing them and racing to create
    // duplicate R2 folders, Slack channels, contracts, and onboarding
    // emails. This update only succeeds for whichever request gets there
    // first — everyone else sees count === 0 and bails before doing any
    // side effects.
    const claim = await prisma.preClient.updateMany({
      where: { id: preClientId, status: 'QUOTE_ACCEPTED' },
      data: { status: 'PROVISIONING' },
    });
    if (claim.count === 0) {
      return NextResponse.json(
        { error: 'Pre-client is already being provisioned' },
        { status: 409 }
      );
    }

    // 1. Create R2 folders (outside DB — slow, keep separate)
    const folders = await createClientFolders(
      preClient.companyName || preClient.name
    ).catch(() => ({
      mainFolderId: null,
      rawFolderId: null,
      elementsFolderId: null,
      outputsFolderId: null,
    }));

    // 2. Create portal User
    const portalUser = await prisma.user.create({
      data: {
        name: preClient.name,
        email: preClient.email,
        password: null,
        role: 'client',
      },
    });

    // 3. Create Client record
    const client = await prisma.client.create({
      data: {
        name: preClient.name,
        email: preClient.email,
        phone: preClient.phone || '',
        companyName: preClient.companyName || null,
        address: preClient.address || null,
        status: 'active',
        startDate: new Date(),
        lastActivity: new Date(),
        preClientId: preClient.id,
        portalPasswordSet: false,
        welcomeVideoWatched: false,
        driveFolderId: folders.mainFolderId,
        rawFootageFolderId: folders.rawFolderId,
        essentialsFolderId: folders.elementsFolderId,
        outputsFolderId: folders.outputsFolderId,
        currentProgress: { completed: 0, total: 0 },
        user: { connect: { id: portalUser.id } },
      },
    });

    // 4. Create ClientPortalAccess
    await prisma.clientPortalAccess.create({
      data: {
        clientId: client.id,
        status: 'ONBOARDING',
      },
    });

    // 4b. Generate Schedules A/B + PSA, merge just those two into one combined
    // PDF, and send that single document through SignWell for the client to
    // sign. The accepted Quote is generated separately and only attached to
    // the portal-setup email below — not part of the signable document.
    // Client stays gated at CONTRACT_PENDING (set once they finish onboarding/
    // set-password) until it's signed — see the signwell webhook, which
    // advances the portal on completion. SignWell emails the client directly
    // to sign (the "documents email").
    const acceptedQuote = preClient.quotes[0];
    let quotePdfBuffer: Buffer | null = null;
    if (acceptedQuote) {
      try {
        quotePdfBuffer = await generateQuotePdf(acceptedQuote as any, preClient as any);
        const schedulesPdfBuffer = await generateScheduleDocsPdf(acceptedQuote as any, preClient as any);
        const contractPdfBuffer = await generateContractPdf(acceptedQuote as any, preClient as any);
        const combinedPdfBuffer = await mergePdfBuffers([contractPdfBuffer, schedulesPdfBuffer]);

        await sendContractViaSignWell({
          buffer: combinedPdfBuffer,
          fileName: 'contract.pdf',
          title: `Professional Services Agreement — ${preClient.companyName || preClient.name}`,
          clientId: client.id,
          createdById: user.id,
          signers: [
            { name: preClient.name, email: preClient.email, sendEmail: true },
            // E8 Productions always co-signs
            { name: 'Eric Davis', email: 'eric@e8productions.com', sendEmail: true },
          ],
        });
        console.log(`✅ [Provision] Combined contract document generated and sent for ${client.name}`);
      } catch (contractErr: any) {
        console.error('[Provision] Contract generation/send FAILED:', contractErr?.message || contractErr);
        await notifyAdminContractFailed(client.name, client.email, contractErr?.message || String(contractErr));
      }
    } else {
      console.error(`[Provision] No accepted quote found for ${preClient.id} — contract not generated`);
    }

    // 5. Create onboarding token
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const onboardingToken = await prisma.onboardingToken.create({
      data: {
        clientId: client.id,
        expiresAt,
      },
    });

    // 6. Mark pre-client as converted
    await prisma.preClient.update({
      where: { id: preClientId },
      data: { status: 'CONVERTED' },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const magicLink = `${baseUrl}/onboarding/${onboardingToken.token}`;

    // Portal setup email — magic link + the accepted quote PDF attached.
    // The combined document (Quote + Schedules A/B + PSA) goes out separately
    // via SignWell's own notification email for signing.
    let emailSent = false;
    try {
      await sendMagicLinkEmail({
        clientName: preClient.name,
        email: preClient.email,
        magicLink,
        attachments: quotePdfBuffer
          ? [{ filename: 'accepted_quote.pdf', content: quotePdfBuffer, contentType: 'application/pdf' }]
          : [],
      });
      emailSent = true;
      console.log(`✅ [Provision] Magic link email sent to ${preClient.email}`);
    } catch (emailErr: any) {
      console.error('[Provision] Magic link email FAILED:', emailErr?.message || emailErr);
      // Don't block — client is created, log the link for manual use
      console.log(`[Provision] Manual magic link: ${magicLink}`);
    }

    createClientSlackChannel({
      clientId: client.id,
      companyName: preClient.companyName || preClient.name,
      clientName: preClient.name,
      clientEmail: preClient.email,
    }).catch((err) => console.error('[Provision] Slack channel failed:', err));

    createRecurringTasksForClient(client.id).catch((err: any) =>
      console.error('[Provision] Recurring tasks failed:', err)
    );

    console.log(`✅ [Provision] Client created: ${client.name} | Magic link: ${magicLink}`);

    return NextResponse.json({
      success: true,
      clientId: client.id,
      magicLink,
      emailSent,
    });
  } catch (err: any) {
    console.error('POST /api/pre-clients/[id]/provision error:', err);
    // Best-effort rollback — otherwise a failed provision leaves the
    // pre-client stuck in PROVISIONING forever with no Client ever created,
    // and the claim above would reject every retry.
    try {
      const { id: pid } = await params;
      await prisma.preClient.updateMany({
        where: { id: pid, status: 'PROVISIONING' },
        data: { status: 'QUOTE_ACCEPTED' },
      });
    } catch {}
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}