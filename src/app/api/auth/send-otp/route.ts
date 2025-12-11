import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateOTP, getOTPExpiryTime } from '@/lib/otp';
import { sendOTPEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { ok: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      // Return success to prevent email enumeration
      return NextResponse.json({
        ok: true,
        message: 'If this email exists, an OTP has been sent.',
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = getOTPExpiryTime();

    // Save OTP to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetOTP: otp,
        resetOTPExpiry: otpExpiry,
      },
    });

    // Try to send OTP via email (won't fail if email not configured)
    try {
      await sendOTPEmail(user.email, otp);
    } catch (emailError) {
      console.error('Email sending failed, but OTP is saved:', emailError);
      // Don't return error - OTP is still logged to console in development
    }

    return NextResponse.json({
      ok: true,
      message: 'OTP has been sent to your email.',
    });
  } catch (error: any) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { ok: false, message: 'An error occurred' },
      { status: 500 }
    );
  }
}