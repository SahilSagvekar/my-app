export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { onboardingToken, user, client, clientPortalAccess } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { notifyFirstPortalLogin } from '@/lib/pipeline-notifications';

// POST /api/onboarding/[token]/set-password
// Public — burns the token, sets the password, returns an auth JWT so client
// is immediately logged in and redirected to their portal
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { token } = await params;
    const { password, watchedVideo } = await req.json();

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const record = await db.query.onboardingToken.findFirst({
      where: eq(onboardingToken.token, token),
      with: {
        client: {
          with: { user: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    if (record.used) {
      return NextResponse.json({ error: 'This link has already been used' }, { status: 410 });
    }

    if (new Date() > new Date(record.expiresAt)) {
      return NextResponse.json({ error: 'This link has expired' }, { status: 410 });
    }

    const clientUser = record.client.user;
    if (!clientUser) {
      return NextResponse.json({ error: 'Client user not found' }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // All in one batch: burn token, set password, mark portal flags, advance portal status.
    // Independent statements, no reads between — array-form $transaction maps to db.batch.
    await db.batch([
      // Burn the token
      db.update(onboardingToken).set({ used: true, usedAt: new Date().toISOString() }).where(eq(onboardingToken.token, token)),
      // Set password on the User record
      db.update(user).set({ password: hashedPassword, updatedAt: new Date().toISOString() }).where(eq(user.id, clientUser.id)),
      // Mark portal flags on Client
      db.update(client).set({
        portalPasswordSet: true,
        welcomeVideoWatched: watchedVideo ?? true,
        updatedAt: new Date().toISOString(),
      }).where(eq(client.id, record.clientId)),
      // Advance portal access to CONTRACT_PENDING
      db.update(clientPortalAccess).set({ status: 'CONTRACT_PENDING', updatedAt: new Date().toISOString() }).where(eq(clientPortalAccess.clientId, record.clientId)),
    ]);

    notifyFirstPortalLogin(record.client.name).catch((err) =>
      console.error('[set-password] notifyFirstPortalLogin failed:', err)
    );

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

  } finally {
    await closeDb();
  }
}
