export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shareableFile, shareRecipient } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { generateOTP, getOTPExpiryTime } from '@/lib/otp';
import { sendShareOtpEmail } from '@/lib/email';

// POST — first step of the public access-gate. Always returns a generic
// success shape regardless of whether the email matched, so a share link
// can't be used to probe which emails were invited.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const db = getDbHttp();
  try {
    const { shareToken } = await params;
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const cleanedEmail = email.trim().toLowerCase();

    const [share] = await db.select().from(shareableFile).where(eq(shareableFile.shareToken, shareToken)).limit(1);
    if (!share || !share.isActive) {
      return NextResponse.json({ error: 'This share link is no longer available' }, { status: 404 });
    }
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
    }

    const [recipient] = await db
      .select()
      .from(shareRecipient)
      .where(and(eq(shareRecipient.shareId, share.id), eq(shareRecipient.email, cleanedEmail)))
      .limit(1);

    if (recipient) {
      const otp = generateOTP();
      await db
        .update(shareRecipient)
        .set({
          otpCode: otp,
          otpExpiresAt: getOTPExpiryTime().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(shareRecipient.id, recipient.id));

      await sendShareOtpEmail({ to: cleanedEmail, otp, itemName: share.fileName });
    }
    // If no recipient matched, silently do nothing — same response either way.

    return NextResponse.json({
      ok: true,
      message: 'If that email has access, a verification code has been sent.',
    });
  } catch (err: any) {
    console.error('[shared/verify-email]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}