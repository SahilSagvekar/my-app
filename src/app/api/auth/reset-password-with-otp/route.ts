export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { isOTPExpired } from '@/lib/otp';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const otp =
      typeof body.otp === 'string' ? body.otp.trim() : '';
    const newPassword =
      typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { ok: false, message: 'All fields are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Find user with matching reset OTP (not loginOTP)
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

    // Check if OTP is expired
    if (isOTPExpired(user.resetOTPExpiry)) {
      return NextResponse.json(
        { ok: false, message: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOTP: null,
        resetOTPExpiry: null,
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'Password has been reset successfully',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { ok: false, message: 'An error occurred' },
      { status: 500 }
    );
  }
}