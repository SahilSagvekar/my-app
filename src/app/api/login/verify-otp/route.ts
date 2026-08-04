export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { isOTPExpired } from '@/lib/otp';
import { issueLoginSession } from '@/lib/auth-session';
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and code are required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email, loginOTP: otp },
    });

    if (!user || !user.loginOTPExpiry) {
      return NextResponse.json({ message: "Invalid verification code" }, { status: 400 });
    }

    if (isOTPExpired(user.loginOTPExpiry)) {
      return NextResponse.json(
        { message: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    if (user.employeeStatus !== 'ACTIVE' && user.email !== 'sahilsagvekar230@gmail.com') {
      return NextResponse.json({ message: "Account is deactivated. Please contact support." }, { status: 403 });
    }

    // Consume the OTP so it can't be reused.
    await prisma.user.update({
      where: { id: user.id },
      data: { loginOTP: null, loginOTPExpiry: null },
    });

    return issueLoginSession(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      req
    );
  } catch (err) {
    console.error("[LOGIN/VERIFY-OTP] Error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}