// GET /api/client/me - Get the logged-in client's information
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { user as userTable, client as clientTable, monthlyDeliverable, oneOffDeliverable } from '@/lib/db/schema';
import { eq, asc, desc, ne } from 'drizzle-orm';
import { getUserFromToken } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const jwtUser = getUserFromToken(req);
    if (!jwtUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }


    // Get the user with their linked client. NOTE: Prisma's `include: { client: true }`
    // here refers to the reverse relation of Client.userId (1:1, unique-indexed) — NOT
    // the linkedClientId-based relation. Drizzle-kit mislabeled that reverse relation
    // `clients: many(client, ...)` on userRelations (pitfall #3 — unique FK mislabeled
    // many()), so we fetch it via `with: { clients: true }` and take [0].
    const user = await db.query.user.findFirst({
      where: eq(userTable.id, jwtUser.userId || jwtUser.id),
      with: { clients: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const clientIdParam = searchParams.get('clientId');
    const isAdmin = ['admin', 'manager'].includes(jwtUser.role?.toLowerCase() ?? '');

    // Get the client ID - either from search param (for admin/manager) or linkedClientId/client relation
    let clientId = user.linkedClientId || user.clients?.[0]?.id;
    if (isAdmin && clientIdParam) {
      clientId = clientIdParam;
    }

    if (!clientId) {
      return NextResponse.json(
        { error: 'No client account linked to this user' },
        { status: 404 }
      );
    }

    // Fetch the full client data
    const client = await db.query.client.findFirst({
      where: eq(clientTable.id, clientId),
      with: {
        monthlyDeliverables: {
          orderBy: asc(monthlyDeliverable.createdAt),
        },
        oneOffDeliverables: {
          where: ne(oneOffDeliverable.status, 'COMPLETED'),
          orderBy: desc(oneOffDeliverable.createdAt),
          limit: 5,
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Return sanitized client info
    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        companyName: client.companyName,
        email: client.email,
        emails: client.emails || [],
        phone: client.phone,
        phones: client.phones || [],
        hasPostingServices: client.hasPostingServices ?? true,
        monthlyDeliverables: client.monthlyDeliverables.map((d) => ({
          id: d.id,
          type: d.type,
          quantity: d.quantity,
          platforms: d.platforms || [],
          description: d.description,
        })),
        // NOTE (schema drift, pre-existing): OneOffDeliverable has no `title`
        // or `dueDate` column in either prisma/schema.prisma or the live DB —
        // the original Prisma code read them anyway, so they always
        // serialized as `undefined` and were dropped by JSON.stringify.
        // Omitting them here reproduces that same (missing-key) output.
        oneOffDeliverables: client.oneOffDeliverables.map((d) => ({
          id: d.id,
          type: d.type,
          status: d.status,
        })),
        billing: client.billing,
        createdAt: client.createdAt,
        status: client.status,
      },
    });
  } catch (error: any) {
    console.error('GET /api/client/me error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}