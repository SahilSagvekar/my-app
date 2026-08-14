export const dynamic = 'force-dynamic';
import { getDbHttp } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { isOTPExpired } from '@/lib/otp';
import { issueLoginSession } from '@/lib/auth-session';
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and code are required" }, { status: 400 });
    }

    const [foundUser] = await db.select().from(user).where(and(eq(user.email, email), eq(user.loginOtp, otp))).limit(1);

    if (!foundUser || !foundUser.loginOtpExpiry) {
      return NextResponse.json({ message: "Invalid verification code" }, { status: 400 });
    }

    if (isOTPExpired(new Date(foundUser.loginOtpExpiry))) {
      return NextResponse.json(
        { message: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    if (foundUser.employeeStatus !== 'ACTIVE' && foundUser.email !== 'sahilsagvekar230@gmail.com') {
      return NextResponse.json({ message: "Account is deactivated. Please contact support." }, { status: 403 });
    }

    // Consume the OTP so it can't be reused.
    await db.update(user).set({
      loginOtp: null,
      loginOtpExpiry: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(user.id, foundUser.id));

    return issueLoginSession(
      { id: foundUser.id, email: foundUser.email, role: foundUser.role, roles: foundUser.roles, name: foundUser.name },
      req
    );
  } catch (err) {
    console.error("[LOGIN/VERIFY-OTP] Error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}