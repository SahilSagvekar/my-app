export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateOTP, getOTPExpiryTime } from '@/lib/otp';
import { sendLoginOTPEmail } from '@/lib/email';
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const [foundUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);

    // Only resend if the user has a login OTP already pending (i.e. they
    // already passed the password step) — don't let this endpoint be used
    // to spam OTP emails to arbitrary addresses without a valid password.
    if (!foundUser || !foundUser.loginOtp) {
      return NextResponse.json({
        message: "If a login is in progress for this email, a new code has been sent.",
      });
    }

    const otp = generateOTP();
    const otpExpiry = getOTPExpiryTime();

    await db.update(user).set({
      loginOtp: otp,
      loginOtpExpiry: otpExpiry.toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(user.id, foundUser.id));

    try {
      await sendLoginOTPEmail(foundUser.email, otp);
    } catch (emailError) {
      console.error("[LOGIN/RESEND-OTP] Failed to send email:", emailError);
    }

    return NextResponse.json({
      message: "If a login is in progress for this email, a new code has been sent.",
    });
  } catch (err) {
    console.error("[LOGIN/RESEND-OTP] Error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}