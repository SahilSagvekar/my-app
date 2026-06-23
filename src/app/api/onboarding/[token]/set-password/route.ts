export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// POST /api/onboarding/[token]/set-password
// Public — burns the token, sets the password, returns an auth JWT so client
// is immediately logged in and redirected to their portal
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const { password, watchedVideo } = await req.json();

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const record = await prisma.onboardingToken.findUnique({
      where: { token },
      include: {
        client: {
          include: { user: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    if (record.used) {
      return NextResponse.json({ error: 'This link has already been used' }, { status: 410 });
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }

    const clientUser = record.client.user;
    if (!clientUser) {
      return NextResponse.json({ error: 'Client user not found' }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // All in one transaction: burn token, set password, mark portal flags, advance portal status
    await prisma.$transaction([
      // Burn the token
      prisma.onboardingToken.update({
        where: { token },
        data: { used: true, usedAt: new Date() },
      }),
      // Set password on the User record
      prisma.user.update({
        where: { id: clientUser.id },
        data: { password: hashedPassword },
      }),
      // Mark portal flags on Client
      prisma.client.update({
        where: { id: record.clientId },
        data: {
          portalPasswordSet: true,
          welcomeVideoWatched: watchedVideo ?? true,
        },
      }),
      // Advance portal access to CONTRACT_PENDING
      prisma.clientPortalAccess.update({
        where: { clientId: record.clientId },
        data: { status: 'CONTRACT_PENDING' },
      }),
    ]);

    // Issue a JWT so client is auto-logged-in
    const authToken = jwt.sign(
      {
        userId: clientUser.id,
        email: clientUser.email,
        role: 'client',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );

    const response = NextResponse.json({
      success: true,
      clientId: record.clientId,
      redirect: '/dashboard',
    });

    // Set the auth cookie (same name as rest of app)
    response.cookies.set('authToken', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('POST /api/onboarding/[token]/set-password error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
