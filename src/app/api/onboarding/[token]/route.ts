export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/onboarding/[token]
// Public — validates the one-time magic link token
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const record = await prisma.onboardingToken.findUnique({
      where: { token },
      include: {
        client: {
          select: {
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

    if (new Date() > record.expiresAt) {
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
}
