import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isOTPExpired } from '@/lib/otp';

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json(
        { ok: false, message: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find user with matching OTP - CHANGED to findFirst
    const user = await prisma.user.findFirst({
      where: {
        email,
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

    // OTP is valid
    return NextResponse.json({
      ok: true,
      message: 'OTP verified successfully',
    });
  } catch (error: any) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { ok: false, message: 'An error occurred' },
      { status: 500 }
    );
  }
}