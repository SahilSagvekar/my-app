export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the client linked to this user
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { userId: user.id },
          { email: user.email },
        ],
      },
      include: { portalAccess: true },
    });

    // No client record at all — not a pipeline client, give full access (legacy)
    if (!client) {
      return NextResponse.json({ status: 'ACTIVE', fullAccess: true });
    }

    // Client exists but no portalAccess record — this is a pipeline client
    // whose ClientPortalAccess wasn't created. Create it now locked to CONTRACT_PENDING
    // so they can't slip through.
    if (!client.portalAccess) {
      // Check if they came through the pipeline (has preClientId)
      if (client.preClientId) {
        // Create the missing record
        await prisma.clientPortalAccess.create({
          data: {
            clientId: client.id,
            status: 'CONTRACT_PENDING',
          },
        });

        return NextResponse.json({
          status: 'CONTRACT_PENDING',
          fullAccess: false,
          locked: false,
          forcePage: 'contracts',
          message: 'Please sign your contract to continue.',
          nextBillingDate: null,
          lockedAt: null,
          adminUnlockedAt: null,
        });
      }

      // Legacy client with no portalAccess — full access
      return NextResponse.json({ status: 'ACTIVE', fullAccess: true });
    }

    const status = client.portalAccess.status;
    const fullAccess = status === 'ACTIVE' || status === 'ADMIN_UNLOCKED';

    const response = {
      status,
      fullAccess,
      locked: status === 'LOCKED',
      forcePage: null as string | null,
      message: null as string | null,
      adminUnlockedAt: client.portalAccess.adminUnlockedAt,
      nextBillingDate: client.portalAccess.nextBillingDate,
      lockedAt: client.portalAccess.lockedAt,
    };

    if (status === 'ONBOARDING') {
      response.forcePage = 'contracts';
      response.message = 'Please complete your onboarding first.';
    } else if (status === 'CONTRACT_PENDING') {
      response.forcePage = 'contracts';
      response.message = 'Please sign your contract to continue.';
    } else if (status === 'PAYMENT_PENDING') {
      response.forcePage = 'contracts';
      response.message = 'Please complete your first payment to unlock your portal.';
    } else if (status === 'LOCKED') {
      response.forcePage = 'contracts';
      response.message = "Your portal is locked pending this month's payment.";
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('GET /api/portal/access error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}