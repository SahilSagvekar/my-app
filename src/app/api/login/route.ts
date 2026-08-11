export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from "next/server";
import { generateOTP, getOTPExpiryTime } from '@/lib/otp';
import { sendLoginOTPEmail } from '@/lib/email';
import { issueLoginSession } from '@/lib/auth-session';

export async function POST(req: NextRequest) {
  try {
    console.log("[LOGIN] 1. Request received");

    const { email, password } = await req.json();
    console.log("[LOGIN] 2. Body parsed:", email);

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    console.log("[LOGIN] 3. Finding user...");
    const [foundUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    console.log("[LOGIN] 4. User found:", !!foundUser);

    if (!foundUser) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    if (foundUser.employeeStatus !== 'ACTIVE' && foundUser.email !== 'sahilsagvekar230@gmail.com') {
      return NextResponse.json({ message: "Account is deactivated. Please contact support." }, { status: 403 });
    }

    if (!foundUser.password) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    console.log("[LOGIN] 5. Comparing password...");
    const isPasswordValid = await bcrypt.compare(password, foundUser.password);
    console.log("[LOGIN] 6. Password valid:", isPasswordValid);

    if (!isPasswordValid) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // Password is correct — now require an email OTP before granting access.
    console.log("[LOGIN] 7. Password verified — sending login OTP");
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
      console.error("[LOGIN] Failed to send login OTP email:", emailError);
      // Don't fail the login attempt — OTP is still saved and logged to console in dev.
    }

    console.log("[LOGIN] 8. OTP sent, awaiting verification");
    return NextResponse.json({
      otpRequired: true,
      email: foundUser.email,
      message: "Enter the verification code sent to your email.",
    });
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    if (err instanceof Error && err.cause) {
      console.error("[LOGIN] Root cause:", err.cause);
    }
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
