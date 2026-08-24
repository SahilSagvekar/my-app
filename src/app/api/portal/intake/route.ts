export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { client as clientTable } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export interface IntakeData {
  // Brand
  brandColors: string[];
  brandFonts: string[];
  brandVoice: string;
  brandGuidelines: string; // URL or description
  logoUrl: string;
  // Platforms
  platforms: string[]; // ['youtube', 'instagram', 'tiktok', 'facebook', 'linkedin']
  platformHandles: Record<string, string>; // { instagram: '@handle', ... }
  // Content
  contentNiche: string;
  targetAudience: string;
  contentStyle: string; // 'educational', 'entertaining', 'promotional', 'mixed'
  topicsToAvoid: string;
  competitorChannels: string;
  // Scheduling
  preferredPostingDays: string[];
  preferredPostingTimes: string[];
  // Contacts
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  // Additional
  additionalNotes: string;
  // Client-added template hashtags (merged with any admin-set defaults)
  hashtags: string[];
}

// POST /api/portal/intake
// Client submits their onboarding intake form after contract + payment
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [client] = await db
      .select()
      .from(clientTable)
      .where(or(eq(clientTable.userId, user.id), eq(clientTable.email, user.email)))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body: IntakeData = await req.json();

    // Merge client-submitted hashtags with any admin-set defaults — never overwrite
    const [existing] = await db
      .select({ templateHashtags: clientTable.templateHashtags })
      .from(clientTable)
      .where(eq(clientTable.id, client.id))
      .limit(1);
    const mergedHashtags = Array.from(
      new Set([
        ...(existing?.templateHashtags ?? []),
        ...(body.hashtags || []).map((h) => h.trim()).filter(Boolean),
      ])
    );

    // Save intake data into existing brandGuidelines and projectSettings JSON fields
    await db.update(clientTable).set({
      templateHashtags: mergedHashtags,
      brandGuidelines: {
        primaryColors: body.brandColors || [],
        secondaryColors: [],
        fonts: body.brandFonts || [],
        logoUsage: body.logoUrl || '',
        toneOfVoice: body.brandVoice || '',
        brandValues: body.brandGuidelines || '',
      },
      projectSettings: {
        contentNiche: body.contentNiche || '',
        targetAudience: body.targetAudience || '',
        contentStyle: body.contentStyle || '',
        topicsToAvoid: body.topicsToAvoid || '',
        competitorChannels: body.competitorChannels || '',
        platforms: body.platforms || [],
        platformHandles: body.platformHandles || {},
        primaryContact: {
          name: body.primaryContactName || '',
          email: body.primaryContactEmail || '',
          phone: body.primaryContactPhone || '',
        },
        additionalNotes: body.additionalNotes || '',
        intakeCompletedAt: new Date().toISOString(),
      },
      postingSchedule: {
        preferredDays: body.preferredPostingDays || [],
        preferredTimes: body.preferredPostingTimes || [],
      },
      updatedAt: new Date().toISOString(),
    }).where(eq(clientTable.id, client.id));

    // Notify admin via email
    await notifyAdminIntakeComplete(client.name, client.email);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('POST /api/portal/intake error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

// GET /api/portal/intake — check if intake is already submitted
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [client] = await db
      .select({ projectSettings: clientTable.projectSettings, templateHashtags: clientTable.templateHashtags })
      .from(clientTable)
      .where(or(eq(clientTable.userId, user.id), eq(clientTable.email, user.email)))
      .limit(1);

    const settings = client?.projectSettings as any;
    const completed = !!settings?.intakeCompletedAt;

    return NextResponse.json({
      completed,
      completedAt: settings?.intakeCompletedAt || null,
      hashtags: client?.templateHashtags ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function notifyAdminIntakeComplete(clientName: string, clientEmail: string) {
  const nodemailer = await import('nodemailer');
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;

  const transporter = nodemailer.default.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: `"E8 Productions" <${process.env.SMTP_USER}>`,
    to: 'eric@e8productions.com',
    subject: `📋 Intake form submitted — ${clientName}`,
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
  <span style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">A client has completed onboarding intake.</span>
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
      <tr><td class="px" style="padding:32px 40px 0 40px;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:22px;line-height:1.35;color:#0a0a0b;">Intake form submitted — ${clientName}</td></tr>
      <tr><td class="px" style="padding:20px 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222225;"><strong>${clientName}</strong> (${clientEmail}) has completed their onboarding intake form. All details are now available in the E8 app under their client profile.</td></tr>
      <tr><td class="px" style="padding:0 40px 32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8a91;border-top:1px solid #e7e7e9;padding-top:16px;">Sent to eric@e8productions.com</td></tr>
    </table>
  </td></tr></table>
</div>
</body>
</html>
`,
  }).catch(console.error);
}
