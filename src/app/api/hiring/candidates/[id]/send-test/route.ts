export const dynamic = 'force-dynamic';
// src/app/api/hiring/candidates/[id]/send-test/route.ts
// Admin sends a test task to a candidate: creates the HiringTestTask row,
// emails a no-login submission link, and (best-effort) a WhatsApp message
// if a provider is ever wired in (see src/lib/whatsapp.ts).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { sendTestTaskInviteEmail } from '@/lib/hiring-email';
import { sendWhatsAppMessage, isWhatsAppConfigured } from '@/lib/whatsapp';

const APP_URL =
  process.env.INTERNAL_APP_URL ||
  process.env.NEXTAUTH_URL ||
  process.env.BASE_URL ||
  'https://e8productions.com';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser2(req);
  if (!user || user.role?.toLowerCase() !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: candidateId } = await params;

  try {
    const body = await req.json();
    const { title, instructions, rawFootageUrl, expiresInDays, sendWhatsApp } = body;

    if (!title || !instructions) {
      return NextResponse.json({ error: 'title and instructions are required' }, { status: 400 });
    }

    const candidate = await prisma.hiringCandidate.findUnique({ where: { id: candidateId } });
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (Number(expiresInDays) > 0 ? Number(expiresInDays) : 14));

    const testTask = await prisma.hiringTestTask.create({
      data: {
        candidateId,
        title,
        instructions,
        rawFootageUrl: rawFootageUrl || null,
        status: 'SENT',
        sentAt: new Date(),
        expiresAt,
      },
    });

    const submissionUrl = new URL(`/hiring-test/${testTask.submissionToken}`, APP_URL).toString();

    const emailResult = await sendTestTaskInviteEmail({
      candidateName: candidate.name,
      candidateEmail: candidate.email,
      taskTitle: title,
      instructions,
      rawFootageUrl,
      submissionUrl,
    });

    let whatsapp: { attempted: boolean; success: boolean } = { attempted: false, success: false };
    if (sendWhatsApp && candidate.phone) {
      whatsapp.attempted = true;
      const waResult = await sendWhatsAppMessage(
        candidate.phone,
        `Hi ${candidate.name} — E8 Productions sent you an editing test task: "${title}". Submit here: ${submissionUrl}`
      );
      whatsapp.success = waResult.success;
    }

    await prisma.hiringCandidate.update({
      where: { id: candidateId },
      data: { status: 'TEST_SENT' },
    });

    return NextResponse.json({
      ok: true,
      testTask,
      submissionUrl,
      email: emailResult,
      whatsapp: sendWhatsApp
        ? { ...whatsapp, configured: isWhatsAppConfigured() }
        : { attempted: false, success: false, configured: isWhatsAppConfigured() },
    });
  } catch (err: any) {
    console.error('[Hiring] Send test task error:', err.message);
    return NextResponse.json({ error: err.message || 'Failed to send test task' }, { status: 500 });
  }
}
