export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { isOTPExpired } from '@/lib/otp';

export async function POST(req: Request) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { email, otp, newPassword } = await req.json();

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

    // Find user with matching OTP
    const [foundUser] = await db.select().from(user).where(and(eq(user.email, email), eq(user.resetOtp, otp))).limit(1);

    if (!foundUser || !foundUser.resetOtpExpiry) {
      return NextResponse.json(
        { ok: false, message: 'Invalid OTP' },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    if (isOTPExpired(new Date(foundUser.resetOtpExpiry))) {
      return NextResponse.json(
        { ok: false, message: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear OTP
    await db.update(user).set({
      password: hashedPassword,
      resetOtp: null,
      resetOtpExpiry: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(user.id, foundUser.id));

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

  } finally {
    await closeDb();
  }
}