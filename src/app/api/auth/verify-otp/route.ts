export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOTPExpired } from '@/lib/otp';

/**
 * Verifies a forgot-password / reset OTP (stored on User.resetOTP).
 * Does NOT consume the OTP — /api/auth/reset-password-with-otp still needs it.
 * Login email OTP lives at /api/login/verify-otp (User.loginOTP).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const otp =
      typeof body.otp === 'string' ? body.otp.trim() : '';

    if (!email || !otp) {
      return NextResponse.json(
        { ok: false, message: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        resetOTP: otp,
      },
    });

    if (!user || !user.resetOTPExpiry) {
      return NextResponse.json(
        { ok: false, message: 'Invalid OTP' },
        { status: 400 }
      );
    }

    if (isOTPExpired(user.resetOTPExpiry)) {
      return NextResponse.json(
        { ok: false, message: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'OTP verified successfully',
    });
  } catch (err) {
    console.error('[AUTH/VERIFY-OTP] Error:', err);
    return NextResponse.json(
      { ok: false, message: 'An error occurred' },
      { status: 500 }
    );
  }
}
