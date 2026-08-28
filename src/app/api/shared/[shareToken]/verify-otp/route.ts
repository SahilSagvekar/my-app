export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shareableFile, shareRecipient } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { isOTPExpired } from '@/lib/otp';
import { createShareAccessToken, shareAccessCookieName } from '@/lib/share-access';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const db = getDbHttp();
  try {
    const { shareToken } = await params;
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
    }
    const cleanedEmail = String(email).trim().toLowerCase();

    const [share] = await db.select().from(shareableFile).where(eq(shareableFile.shareToken, shareToken)).limit(1);
    if (!share || !share.isActive) {
      return NextResponse.json({ error: 'This share link is no longer available' }, { status: 404 });
    }

    const [recipient] = await db
      .select()
      .from(shareRecipient)
      .where(and(eq(shareRecipient.shareId, share.id), eq(shareRecipient.email, cleanedEmail)))
      .limit(1);

    if (!recipient || !recipient.otpCode || recipient.otpCode !== otp) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }
    if (!recipient.otpExpiresAt || isOTPExpired(new Date(recipient.otpExpiresAt))) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    await db
      .update(shareRecipient)
      .set({
        status: 'verified',
        otpCode: null,
        otpExpiresAt: null,
        lastAccessedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shareRecipient.id, recipient.id));

    const accessToken = createShareAccessToken(shareToken, cleanedEmail);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(shareAccessCookieName(shareToken), accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('[shared/verify-otp]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}