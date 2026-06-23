export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
}

// POST /api/portal/intake
// Client submits their onboarding intake form after contract + payment
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await prisma.client.findFirst({
      where: {
        OR: [{ userId: user.id }, { email: user.email }],
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const body: IntakeData = await req.json();

    // Save intake data into existing brandGuidelines and projectSettings JSON fields
    await prisma.client.update({
      where: { id: client.id },
      data: {
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
      },
    });

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
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = await prisma.client.findFirst({
      where: { OR: [{ userId: user.id }, { email: user.email }] },
      select: { projectSettings: true },
    });

    const settings = client?.projectSettings as any;
    const completed = !!settings?.intakeCompletedAt;

    return NextResponse.json({ completed, completedAt: settings?.intakeCompletedAt || null });
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
    html: `<p><strong>${clientName}</strong> (${clientEmail}) has completed their onboarding intake form. All details are now available in the E8 app under their client profile.</p>`,
  }).catch(console.error);
}
