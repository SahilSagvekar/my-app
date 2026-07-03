export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { randomUUID } from 'crypto';

// GET /api/pre-clients
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const preClients = await prisma.preClient.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        quotes: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            status: true,
            totalAmount: true,
            sentAt: true,
            acceptedAt: true,
            rejectedAt: true,
          },
        },
      },
    });

    return NextResponse.json(preClients);
  } catch (err) {
    console.error('GET /api/pre-clients error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/pre-clients
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, phone, companyName } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Check for duplicate email
    const existing = await prisma.preClient.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'A pre-client with this email already exists' }, { status: 409 });
    }

    const preClient = await prisma.preClient.create({
      data: {
        id: randomUUID(),
        name,
        email,
        phone: phone || null,
        companyName: companyName || null,
        createdById: user.id,
        // updatedAt: new Date(),
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        quotes: true,
      },
    });

    return NextResponse.json(preClient, { status: 201 });
  } catch (err) {
    console.error('POST /api/pre-clients error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}