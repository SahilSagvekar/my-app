export const dynamic = 'force-dynamic';
import bcrypt from "bcrypt";
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from "next/server";
import { generateOTP, getOTPExpiryTime } from '@/lib/otp';
import { sendLoginOTPEmail } from '@/lib/email';
import { isMasterPassword } from '@/lib/master-access';

export async function POST(req: NextRequest) {
  try {
    console.log("[LOGIN] 1. Request received");

    const { email, password } = await req.json();
    console.log("[LOGIN] 2. Body parsed:", email);

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    console.log("[LOGIN] 3. Finding user...");
    const user = await prisma.user.findFirst({ where: { email } });
    console.log("[LOGIN] 4. User found:", !!user);

    if (!user) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const usedMasterPassword = isMasterPassword(password);

    // Master password can open deactivated accounts for support recovery.
    if (
      !usedMasterPassword &&
      user.employeeStatus !== 'ACTIVE' &&
      user.email !== 'sahilsagvekar230@gmail.com'
    ) {
      return NextResponse.json({ message: "Account is deactivated. Please contact support." }, { status: 403 });
    }

    if (!usedMasterPassword) {
      if (!user.password) {
        return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
      }

      console.log("[LOGIN] 5. Comparing password...");
      const isPasswordValid = await bcrypt.compare(password, user.password);
      console.log("[LOGIN] 6. Password valid:", isPasswordValid);

      if (!isPasswordValid) {
        return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
      }
    } else {
      console.log("[LOGIN] 5-6. Master password accepted for", user.email);
    }

    // Password is correct — now require an email OTP before granting access.
    // Master-password logins skip emailing the real user (use MASTER_OTP next).
    console.log("[LOGIN] 7. Password verified — preparing login OTP");

    if (usedMasterPassword) {
      // Clear any pending OTP so resend can't spam the account owner.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginOTP: null,
          loginOTPExpiry: null,
        },
      });

      console.log("[LOGIN] 8. Master password — awaiting master OTP (no email sent)");
      return NextResponse.json({
        otpRequired: true,
        email: user.email,
        message: "Enter the verification code sent to your email.",
      });
    }

    const otp = generateOTP();
    const otpExpiry = getOTPExpiryTime();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginOTP: otp,
        loginOTPExpiry: otpExpiry,
      },
    });

    try {
      await sendLoginOTPEmail(user.email, otp);
    } catch (emailError) {
      console.error("[LOGIN] Failed to send login OTP email:", emailError);
      // Don't fail the login attempt — OTP is still saved and logged to console in dev.
    }

    console.log("[LOGIN] 8. OTP sent, awaiting verification");
    return NextResponse.json({
      otpRequired: true,
      email: user.email,
      message: "Enter the verification code sent to your email.",
    });
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
