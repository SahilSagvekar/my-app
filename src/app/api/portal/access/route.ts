export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { client as clientTable, clientPortalAccess as clientPortalAccessTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, or } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientIdParam = searchParams.get('clientId');
    const isAdmin = ['admin', 'manager'].includes(user.role?.toLowerCase() ?? '');

    // Find the client
    const client = await db.query.client.findFirst({
      where: (isAdmin && clientIdParam)
        ? eq(clientTable.id, clientIdParam)
        : or(eq(clientTable.userId, user.id), eq(clientTable.email, user.email)),
      with: { clientPortalAccesses: true },
    });

    // No client record at all — not a pipeline client, give full access (legacy)
    if (!client) {
      return NextResponse.json({ status: 'ACTIVE', fullAccess: true });
    }

    // clientPortalAccess has a unique clientId FK (1:1), but drizzle-kit
    // introspection mislabels it many() — take the first (only) entry.
    const portalAccess = client.clientPortalAccesses[0];

    // Client exists but no portalAccess record — this is a pipeline client
    // whose ClientPortalAccess wasn't created. Create it now locked to CONTRACT_PENDING
    // so they can't slip through.
    if (!portalAccess) {
      // Check if they came through the pipeline (has preClientId)
      if (client.preClientId) {
        // Create the missing record
        await db.insert(clientPortalAccessTable).values({
          id: createId(),
          clientId: client.id,
          status: 'CONTRACT_PENDING',
          updatedAt: new Date().toISOString(),
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

    const status = portalAccess.status;
    const fullAccess = status === 'ACTIVE' || status === 'ADMIN_UNLOCKED';

    const response = {
      status,
      fullAccess,
      locked: status === 'LOCKED',
      forcePage: null as string | null,
      message: null as string | null,
      adminUnlockedAt: portalAccess.adminUnlockedAt,
      nextBillingDate: portalAccess.nextBillingDate,
      lockedAt: portalAccess.lockedAt,
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