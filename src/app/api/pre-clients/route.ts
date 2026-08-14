export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { preClient as preClientTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// GET /api/pre-clients
export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await db.query.preClient.findMany({
      orderBy: (pc, { desc }) => [desc(pc.createdAt)],
      with: {
        user: { columns: { id: true, name: true, email: true } },
        quotes: {
          orderBy: (q, { desc }) => [desc(q.version)],
        },
      },
    });

    const preClients = rows.map(({ user: createdBy, ...rest }) => ({ ...rest, createdBy }));

    return NextResponse.json(preClients);
  } catch (err) {
    console.error('GET /api/pre-clients error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}

// POST /api/pre-clients
export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, phone, companyName, address } = body;


    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Check for duplicate email
    const [existing] = await db.select().from(preClientTable).where(eq(preClientTable.email, email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: 'A pre-client with this email already exists' }, { status: 409 });
    }

    const [created] = await db.insert(preClientTable).values({
      id: createId(),
      name,
      email,
      phone: phone || null,
      companyName: companyName || null,
      address: address || null,
      createdById: user.id,
      updatedAt: new Date().toISOString(),
    }).returning();

    const row = await db.query.preClient.findFirst({
      where: (pc, { eq }) => eq(pc.id, created.id),
      with: {
        user: { columns: { id: true, name: true, email: true } },
        quotes: true,
      },
    });

    const { user: createdBy, ...rest } = row!;
    const preClient = { ...rest, createdBy };

    return NextResponse.json(preClient, { status: 201 });
  } catch (err) {
    console.error('POST /api/pre-clients error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}
