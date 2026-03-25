// GET /api/client/me - Get the logged-in client's information
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const jwtUser = getUserFromToken(req);
    if (!jwtUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user with their linked client
    const user = await prisma.user.findFirst({
      where: { id: jwtUser.userId || jwtUser.id },
      include: { client: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the client ID - either from linkedClientId or from client relation
    const clientId = user.linkedClientId || user.client?.id;

    if (!clientId) {
      return NextResponse.json(
        { error: 'No client account linked to this user' },
        { status: 404 }
      );
    }

    // Fetch the full client data
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        monthlyDeliverables: {
          orderBy: { createdAt: 'asc' },
        },
        oneOffDeliverables: {
          where: { status: { not: 'COMPLETED' } },
          orderBy: { createdAt: 'desc' },
          take: 5,
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
        oneOffDeliverables: client.oneOffDeliverables.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          status: d.status,
          dueDate: d.dueDate,
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