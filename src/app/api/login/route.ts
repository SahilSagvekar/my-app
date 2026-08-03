export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { generateOTP, getOTPExpiryTime } from '@/lib/otp';
import { sendLoginOTPEmail } from '@/lib/email';
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { email } });

    // Only resend if the user has a login OTP already pending (i.e. they
    // already passed the password step) — don't let this endpoint be used
    // to spam OTP emails to arbitrary addresses without a valid password.
    if (!user || !user.loginOTP) {
      return NextResponse.json({
        message: "If a login is in progress for this email, a new code has been sent.",
      });
    }

    const otp = generateOTP();
    const otpExpiry = getOTPExpiryTime();

    await prisma.user.update({
      where: { id: user.id },
      data: { loginOTP: otp, loginOTPExpiry: otpExpiry },
    });

    try {
      await sendLoginOTPEmail(user.email, otp);
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
}