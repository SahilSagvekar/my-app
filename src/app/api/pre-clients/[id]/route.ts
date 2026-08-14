export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { preClient as preClientTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const row = await db.query.preClient.findFirst({
      where: (pc, { eq }) => eq(pc.id, id),
      with: {
        user: { columns: { id: true, name: true, email: true } },
        quotes: { orderBy: (q, { desc }) => [desc(q.version)] },
      },
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const { user: createdBy, ...rest } = row;
    const preClient = { ...rest, createdBy };
    return NextResponse.json(preClient);
  } catch (err) {
    console.error('GET /api/pre-clients/[id] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const { name, email, phone, companyName, status } = body;
    const [preClient] = await db.update(preClientTable).set({
      ...(name && { name }),
      ...(email && { email }),
      ...(phone !== undefined && { phone }),
      ...(companyName !== undefined && { companyName }),
      ...(status && { status }),
      updatedAt: new Date().toISOString(),
    }).where(eq(preClientTable.id, id)).returning();
    return NextResponse.json(preClient);
  } catch (err) {
    console.error('PATCH /api/pre-clients/[id] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const [preClient] = await db.select().from(preClientTable).where(eq(preClientTable.id, id)).limit(1);
    if (!preClient) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (preClient.status === 'CONVERTED') {
      return NextResponse.json(
        { error: 'This pre-client has already been converted to a client — manage or delete it from Client Management instead.' },
        { status: 400 }
      );
    }
    await db.delete(preClientTable).where(eq(preClientTable.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/pre-clients/[id] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
