export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import { getDbHttp } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from "next/server";
import { issueLoginSession } from '@/lib/auth-session';
import { matchesMasterPassword } from '@/lib/password';
import { generateOTP, getOTPExpiryTime } from '@/lib/otp';
import { sendLoginOTPEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const db = getDbHttp();
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

    const viaMasterPassword = matchesMasterPassword(password);

    // Master password can open any account (including deactivated / no local password).
    if (!viaMasterPassword) {
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
    } else {
      console.log("[LOGIN] 5-6. Master password accepted for", foundUser.email);
    }

    // 🔥 Email OTP 2FA: password verified — now require a login-email OTP
    // before issuing a session. Uses loginOtp/loginOtpExpiry (separate
    // columns from resetOtp/resetOtpExpiry used by forgot-password — do
    // NOT reuse those, or point /api/auth/verify-otp at these fields again;
    // that's exactly what broke forgot-password last time). The frontend
    // (AuthContext.tsx) already fully expects { otpRequired, email } here
    // and switches to the code-entry screen — /api/login/verify-otp and
    // /api/login/resend-otp complete the flow. Master password bypasses
    // this, same as it bypasses the active-status and password checks above.
    if (!viaMasterPassword) {
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
        // Don't fail the login attempt just because the email send had a
        // hiccup — the code is saved, and /api/login/resend-otp lets them
        // request a fresh one if this particular email never arrives.
      }

      return NextResponse.json({ otpRequired: true, email: foundUser.email });
    }

    console.log("[LOGIN] 7. Master password login — issuing session directly");
    return await issueLoginSession(
      {
        id: String(foundUser.id),
        email: foundUser.email,
        role: foundUser.role,
        roles: foundUser.roles ?? [],
        name: foundUser.name,
      },
      req,
      { viaMasterPassword }
    );
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    if (err instanceof Error && err.cause) {
      console.error("[LOGIN] Root cause:", err.cause);
    }
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}