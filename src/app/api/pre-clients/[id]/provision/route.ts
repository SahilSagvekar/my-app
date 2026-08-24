export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  preClient as preClientTable,
  client as clientTable,
  user as userTable,
  clientPortalAccess as clientPortalAccessTable,
  onboardingToken as onboardingTokenTable,
} from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { createClientFolders } from '@/lib/s3';
import { createClientSlackChannel } from '@/lib/client-onboarding';
import { createTransporter as getTransporter } from '@/lib/mail-transport';
import { createRecurringTasksForClient } from '@/app/api/clients/recurring';
import { generateQuotePdf } from '@/lib/quote-pdf';
import { generateContractPdf, generateScheduleDocsPdf, mergePdfBuffers } from '@/lib/contract-pdf';
import { sendContractViaSignWell } from '@/lib/contracts';

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
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
body { margin: 0; padding: 0; }
  @media (max-width: 620px) { .container { width: 100% !important; } .px { padding-left: 24px !important; padding-right: 24px !important; } }
  table { border-collapse: collapse; }
</style>
</head>
<body style="margin:0;padding:0;">
<div style="background-color:#f4f4f5;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Your E8 client portal is ready.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #d3d3d6;border-radius:12px;box-shadow:0 2px 12px rgba(10,10,11,0.06);">
      <tr><td class="px" style="padding:20px 40px 16px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:27px;vertical-align:middle;"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABgCAYAAAC+EjQcAAAE4ElEQVR4AeycXZqqMAyGUy7VPR1nZejKxtkT9tKefpRgQTAKFRDSZ2KR0DZ5ScrP4zSjkeVwOBx3u8Npv9//sux2ezeXwAbYA4FtI92jQYAwMAyAMbeb+yVyuXN0ZBlr1Jj2sIHI5eQFtoUTdTgN7fMtQADThtI1sDF0mVJILC4fCuplQIgYnBHnIyW2ByCyzPywWHs11+v1Z0ohMmd6qbwPSgTEUYOQjW0wPkoABSCKoriwxMcsd9vlyAT4Jtn4FBA6aEcNwHCUAIo0wFL1yAT4Bh+f2dgLiFOKGwMMRwzvW0MNSPC1z5dOQKGBy7kR4HAq8b511S7vi6QHQOHAOxzyEyDg0MoLIin43nT0AZBzTTjWFoPvIZpDLf9b0/dgbwMQUstFl/EtwQEO+A4G2GZpACJ/91kr/L0Nb2+rbs5HNaAmOXP+5kv42BMap1oJKExOLueOt5Za7DfXzk8zgQmFh9XbjY5UF/P8tr0+bhsbZQRRNPdsPXr4tHOaZRxKUBj/fIVaxYdMlWZZnF7Omb8xcAAbD4Hh1cJ0L828O/kYu/vagk2VYuGQLKMLDSy4CuJu1HnyA7tYXDNj3L8MH2zZ0Es7IoeieQz9GZ+uUwrG/IRkKc44QpGNAxQ7w0szjEn+uZESl0aKDe/b5dx2zgdbm/i50fnpogaEM89Oan0nUAO679KtmIACiml0bCugDijxLgUU0+jYVkAdUOJdUwCKx/u6bQUknDIFpIAEAoJaI0gBCQQEtUaQAhIICGqNIAUkEBDUySNo6hf27fEEf99WJwf0tgULb6CAhBOUBJD1L+lTiWDv5OokgJJbvaAOFZBwMhSQAhIICGqNIAUkEBDUGkEKSCAgqDWCFJBAQFBrBCkggYCg1giaAlD7pdWY74K9k6vXEkEfA5ccEH7KN6ekJpUcEH7EOacsHlBqA+fuL3kEze1Q6vEVkEBUASkggYCg1ghSQAIBQa0RpIAEAoJaI0gBCQQE9XYjSADDagXEJHpqBdQDhncrICbRUycBhBdk3H/4F3H+9v11DQj/4ZvCHV7zIkVf7/aBxQ3ebSMdn6U4+8aYesUYgMZLeyxRMaVgTGotbiA5L+mNoUsdQdLBz/RhxQZTQ8KxADWlYMzU4pz58xF0d2xMelhbnKy9GvrA6gc0Y0kSQbH9tgJlPayphD50UrDYSxbSg8riHB3XdhUqHRv4ATZlBBk/GXEfY9KM+1hHbco5tQIUvsAxjSJQILJ+qsBWCQihZDSKwKMSU0YPvpSAsGFa9zJbnoswOYMJpAZUFMWFoqvBduei5iKbNSDyBXlnqlTDXIQ7Yb97M3/wHQxihxuAoDCtVPvE8w3GWaLEvrN9D4AwYWeNhW7D+u/cYK01fIbvbf8eAOGAcKCpZ3KkGx4G1ztxN+cdMGDpBARlyMU7JOzDOolrSzlETvAVHj5KLyAciobWP1OZauLGPrxSQDQB1DdHFHwCnJAtwbOuz6eAuAF+MUbRLQCVxeUhorAk6eEEWJBStfgPc4ZPEhy48RIgHGj9rbf10UQPoMiXAOsObO9wizCVxKuJemN6/zhqrPel96CW4mVA3A6d2woUBuT97RoT+5TSHp+/BxvNGen0atRwW9RvA0IjiPVnAQPaChb5yIIxEJqpYGwWAIEEG4vTK+nUZfZ/AAAA//9KLssaAAAABklEQVQDAELh2umNXjYGAAAAAElFTkSuQmCC" width="27" height="36" alt="E8" style="display:block;width:27px;height:36px;"></td>
          <td style="width:12px;">&nbsp;</td>
          <td style="font-family:Helvetica,Arial,sans-serif;font-size:25px;font-weight:bold;letter-spacing:0.2px;color:#0a0a0b;vertical-align:middle;">E8 App</td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:0 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Welcome to E8 Productions</td></tr>
      <tr><td class="px" style="padding:6px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#8a8a91;letter-spacing:0.1em;text-transform:uppercase;">Full Service Video + Content</td></tr>
      <tr><td class="px" style="padding:20px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Hi ${params.clientName}, your proposal has been accepted — your accepted quote is attached below for your records. Your E8 client portal is ready — click the button below to get started. You'll watch a quick welcome video, set your password, and sign your Professional Services Agreement (sent separately for signature) all at once.</td></tr>
      <tr><td class="px" align="center" style="padding:24px 40px 0 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="background-color:#0a0a0b;text-align:center;border-radius:8px;" bgcolor="#0a0a0b">
          <a href="${params.magicLink}" style="display:block;padding:16px 36px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;letter-spacing:0.2px;border-radius:8px;">Access Your Portal →</a>
        </td></tr></table>
      </td></tr>
      <tr><td class="px" style="padding: 16px 40px 0 40px; font-family: Helvetica,Arial,sans-serif; font-size: 13px; line-height: 1.6; color: #8a8a91; text-align: left">This link is one-time use and expires in 48 hours. If you didn't expect this email, please ignore it.</td></tr>
      <tr><td class="px" style="padding:32px 40px 24px 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;">E8 Productions, LLC · e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
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
      html: `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
body { margin: 0; padding: 0; }
  @media (max-width: 620px) { .container { width: 100% !important; } .px { padding-left: 24px !important; padding-right: 24px !important; } }
  table { border-collapse: collapse; }
</style>
</head>
<body style="margin:0;padding:0;">
<div style="background-color:#f4f4f5;margin:0;padding:0;font-family:Helvetica,Arial,sans-serif;">
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Automatic contract generation failed during provisioning.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #d3d3d6;border-radius:12px;box-shadow:0 2px 12px rgba(10,10,11,0.06);">
      <tr><td class="px" style="padding:20px 40px 16px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="width:27px;vertical-align:middle;"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABgCAYAAAC+EjQcAAAE4ElEQVR4AeycXZqqMAyGUy7VPR1nZejKxtkT9tKefpRgQTAKFRDSZ2KR0DZ5ScrP4zSjkeVwOBx3u8Npv9//sux2ezeXwAbYA4FtI92jQYAwMAyAMbeb+yVyuXN0ZBlr1Jj2sIHI5eQFtoUTdTgN7fMtQADThtI1sDF0mVJILC4fCuplQIgYnBHnIyW2ByCyzPywWHs11+v1Z0ohMmd6qbwPSgTEUYOQjW0wPkoABSCKoriwxMcsd9vlyAT4Jtn4FBA6aEcNwHCUAIo0wFL1yAT4Bh+f2dgLiFOKGwMMRwzvW0MNSPC1z5dOQKGBy7kR4HAq8b511S7vi6QHQOHAOxzyEyDg0MoLIin43nT0AZBzTTjWFoPvIZpDLf9b0/dgbwMQUstFl/EtwQEO+A4G2GZpACJ/91kr/L0Nb2+rbs5HNaAmOXP+5kv42BMap1oJKExOLueOt5Za7DfXzk8zgQmFh9XbjY5UF/P8tr0+bhsbZQRRNPdsPXr4tHOaZRxKUBj/fIVaxYdMlWZZnF7Omb8xcAAbD4Hh1cJ0L828O/kYu/vagk2VYuGQLKMLDSy4CuJu1HnyA7tYXDNj3L8MH2zZ0Es7IoeieQz9GZ+uUwrG/IRkKc44QpGNAxQ7w0szjEn+uZESl0aKDe/b5dx2zgdbm/i50fnpogaEM89Oan0nUAO679KtmIACiml0bCugDijxLgUU0+jYVkAdUOJdUwCKx/u6bQUknDIFpIAEAoJaI0gBCQQEtUaQAhIICGqNIAUkEBDUySNo6hf27fEEf99WJwf0tgULb6CAhBOUBJD1L+lTiWDv5OokgJJbvaAOFZBwMhSQAhIICGqNIAUkEBDUGkEKSCAgqDWCFJBAQFBrBCkggYCg1giaAlD7pdWY74K9k6vXEkEfA5ccEH7KN6ekJpUcEH7EOacsHlBqA+fuL3kEze1Q6vEVkEBUASkggYCg1ghSQAIBQa0RpIAEAoJaI0gBCQQE9XYjSADDagXEJHpqBdQDhncrICbRUycBhBdk3H/4F3H+9v11DQj/4ZvCHV7zIkVf7/aBxQ3ebSMdn6U4+8aYesUYgMZLeyxRMaVgTGotbiA5L+mNoUsdQdLBz/RhxQZTQ8KxADWlYMzU4pz58xF0d2xMelhbnKy9GvrA6gc0Y0kSQbH9tgJlPayphD50UrDYSxbSg8riHB3XdhUqHRv4ATZlBBk/GXEfY9KM+1hHbco5tQIUvsAxjSJQILJ+qsBWCQihZDSKwKMSU0YPvpSAsGFa9zJbnoswOYMJpAZUFMWFoqvBduei5iKbNSDyBXlnqlTDXIQ7Yb97M3/wHQxihxuAoDCtVPvE8w3GWaLEvrN9D4AwYWeNhW7D+u/cYK01fIbvbf8eAOGAcKCpZ3KkGx4G1ztxN+cdMGDpBARlyMU7JOzDOolrSzlETvAVHj5KLyAciobWP1OZauLGPrxSQDQB1DdHFHwCnJAtwbOuz6eAuAF+MUbRLQCVxeUhorAk6eEEWJBStfgPc4ZPEhy48RIgHGj9rbf10UQPoMiXAOsObO9wizCVxKuJemN6/zhqrPel96CW4mVA3A6d2woUBuT97RoT+5TSHp+/BxvNGen0atRwW9RvA0IjiPVnAQPaChb5yIIxEJqpYGwWAIEEG4vTK+nUZfZ/AAAA//9KLssaAAAABklEQVQDAELh2umNXjYGAAAAAElFTkSuQmCC" width="27" height="36" alt="E8" style="display:block;width:27px;height:36px;"></td>
          <td style="width:12px;">&nbsp;</td>
          <td style="font-family:Helvetica,Arial,sans-serif;font-size:25px;font-weight:bold;letter-spacing:0.2px;color:#0a0a0b;vertical-align:middle;">E8 App</td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:0 40px;"><div style="border-top:1px solid #e7e7e9;font-size:0;line-height:0;">&nbsp;</div></td></tr>
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Contract auto-generation failed — ${clientName}</td></tr>
      <tr><td class="px" style="padding:20px 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;">Automatic contract generation/send failed for <strong>${clientName}</strong> (${clientEmail}) during provisioning.<br><br>Error: ${errorMessage}<br><br>Please create and send the contract manually via the Contracts tab.</td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;border-top:1px solid #e7e7e9;padding-top:16px;">Sent to eric@e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
`,
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
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preClientId } = await params;

    const preClient = await db.query.preClient.findFirst({
      where: (pc, { eq }) => eq(pc.id, preClientId),
      with: {
        quotes: {
          where: (q, { eq }) => eq(q.status, 'ACCEPTED'),
          orderBy: (q, { desc }) => [desc(q.version)],
          limit: 1,
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
    const [existingClient] = await db.select().from(clientTable).where(eq(clientTable.email, preClient.email)).limit(1);
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
    const claim = await db.update(preClientTable)
      .set({ status: 'PROVISIONING', updatedAt: new Date().toISOString() })
      .where(and(eq(preClientTable.id, preClientId), eq(preClientTable.status, 'QUOTE_ACCEPTED')))
      .returning({ id: preClientTable.id });
    if (claim.length === 0) {
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
    const [portalUser] = await db.insert(userTable).values({
      name: preClient.name,
      email: preClient.email,
      password: null,
      role: 'client',
      updatedAt: new Date().toISOString(),
    }).returning();

    // 3. Create Client record
    const [client] = await db.insert(clientTable).values({
      id: createId(),
      name: preClient.name,
      email: preClient.email,
      phone: preClient.phone || '',
      companyName: preClient.companyName || null,
      address: preClient.address || null,
      status: 'active',
      startDate: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      preClientId: preClient.id,
      portalPasswordSet: false,
      welcomeVideoWatched: false,
      driveFolderId: folders.mainFolderId,
      rawFootageFolderId: folders.rawFolderId,
      essentialsFolderId: folders.elementsFolderId,
      outputsFolderId: folders.outputsFolderId,
      currentProgress: { completed: 0, total: 0 },
      userId: portalUser.id,
      updatedAt: new Date().toISOString(),
    }).returning();

    // 4. Create ClientPortalAccess
    await db.insert(clientPortalAccessTable).values({
      id: createId(),
      clientId: client.id,
      status: 'ONBOARDING',
      updatedAt: new Date().toISOString(),
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
    const [onboardingToken] = await db.insert(onboardingTokenTable).values({
      id: createId(),
      clientId: client.id,
      token: createId(),
      expiresAt: expiresAt.toISOString(),
    }).returning();

    // 6. Mark pre-client as converted
    await db.update(preClientTable).set({
      status: 'CONVERTED',
      updatedAt: new Date().toISOString(),
    }).where(eq(preClientTable.id, preClientId));

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

    createRecurringTasksForClient(client.id, db).catch((err: any) =>
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
      await db.update(preClientTable)
        .set({ status: 'QUOTE_ACCEPTED', updatedAt: new Date().toISOString() })
        .where(and(eq(preClientTable.id, pid), eq(preClientTable.status, 'PROVISIONING')));
    } catch {}
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}