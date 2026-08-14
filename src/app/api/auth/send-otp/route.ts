export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateOTP, getOTPExpiryTime } from '@/lib/otp';
import { sendOTPEmail } from '@/lib/email';

export async function POST(req: Request) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { ok: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user
    const [foundUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);

    if (!foundUser) {
      // Return success to prevent email enumeration
      return NextResponse.json({
        ok: true,
        message: 'If this email exists, an OTP has been sent.',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = getOTPExpiryTime();

    // Save OTP to database
    await db.update(user).set({
      resetOtp: otp,
      resetOtpExpiry: otpExpiry.toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(user.id, foundUser.id));

    // Try to send OTP via email (won't fail if email not configured)
    try {
      await sendOTPEmail(foundUser.email, otp);
    } catch (emailError) {
      console.error('Email sending failed, but OTP is saved:', emailError);
      // Don't return error - OTP is still logged to console in development
    }

    return NextResponse.json({
      ok: true,
      message: 'OTP has been sent to your email.',
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { ok: false, message: 'An error occurred' },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}