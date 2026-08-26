export const dynamic = 'force-dynamic';
import { getDbHttp } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { isOTPExpired } from '@/lib/otp';
import { NextRequest, NextResponse } from "next/server";

// Step 2 of the forgot-password flow: check the reset code the user typed
// in before letting them move on to picking a new password. Pairs with
// /api/auth/send-otp (writes resetOtp/resetOtpExpiry) and
// /api/auth/reset-password-with-otp (the actual consume-and-reset step —
// this route deliberately does NOT clear resetOtp itself, so that final
// step can still validate it).
//
// 🔥 This used to check loginOtp/loginOtpExpiry and call issueLoginSession —
// a copy-paste from the login-2FA feature (/api/login/verify-otp) that
// landed on this shared path and broke forgot-password entirely: anyone
// resetting their password would always get "Invalid verification code"
// here, since they'd never have a loginOtp set. Restored to check the
// reset fields. Login 2FA has its own dedicated route at
// /api/login/verify-otp — don't repoint that one here again.
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ ok: false, message: "Email and code are required" }, { status: 400 });
    }

    const [foundUser] = await db.select().from(user).where(and(eq(user.email, email), eq(user.resetOtp, otp))).limit(1);

    if (!foundUser || !foundUser.resetOtpExpiry) {
      return NextResponse.json({ ok: false, message: "Invalid OTP" }, { status: 400 });
    }

    if (isOTPExpired(new Date(foundUser.resetOtpExpiry))) {
      return NextResponse.json(
        { ok: false, message: "OTP has expired. Please request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, message: "OTP verified" });
  } catch (err) {
    console.error("[AUTH/VERIFY-OTP] Error:", err);
    return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
  }
}