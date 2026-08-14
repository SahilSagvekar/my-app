export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// GET /api/onboarding/[token]
// Public — validates the one-time magic link token
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { token } = await params;

    const record = await db.query.onboardingToken.findFirst({
      where: (t, { eq }) => eq(t.token, token),
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            email: true,
            companyName: true,
            portalPasswordSet: true,
            welcomeVideoWatched: true,
          },
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

    return NextResponse.json({
      valid: true,
      clientId: record.clientId,
      client: record.client,
    });
  } catch (err) {
    console.error('GET /api/onboarding/[token] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}
