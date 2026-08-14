export const dynamic = 'force-dynamic';
// src/app/api/hiring/candidates/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hiringCandidate, hiringTestTask, user as userTable } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user || user.role?.toLowerCase() !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, closeDb } = getDb();
  try {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [candidateRow] = await db.select().from(hiringCandidate).where(eq(hiringCandidate.id, id)).limit(1);
  if (!candidateRow) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const createdBy = candidateRow.createdById
    ? (await db.select({ id: userTable.id, name: userTable.name }).from(userTable).where(eq(userTable.id, candidateRow.createdById)).limit(1))[0] ?? null
    : null;

  const testTaskRows = await db.select({
    task: hiringTestTask,
    reviewedBy: { id: userTable.id, name: userTable.name },
  })
    .from(hiringTestTask)
    .leftJoin(userTable, eq(hiringTestTask.reviewedById, userTable.id))
    .where(eq(hiringTestTask.candidateId, id))
    .orderBy(desc(hiringTestTask.createdAt));

  const testTasks = testTaskRows.map(r => ({ ...r.task, reviewedBy: r.reviewedBy.id !== null ? r.reviewedBy : null }));

  const candidate = { ...candidateRow, testTasks, createdBy };

  return NextResponse.json({ candidate });

  } finally {
    await closeDb();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, closeDb } = getDb();
  try {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, email, phone, portfolioUrl, resumeUrl, source, notes, status } = body;

  try {
    const [candidate] = await db.update(hiringCandidate)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(portfolioUrl !== undefined ? { portfolioUrl } : {}),
        ...(resumeUrl !== undefined ? { resumeUrl } : {}),
        ...(source !== undefined ? { source } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(status !== undefined ? { status } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hiringCandidate.id, id))
      .returning();
    return NextResponse.json({ candidate });
  } catch (err: any) {
    console.error('[Hiring] Update candidate error:', err.message);
    return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { db, closeDb } = getDb();
  try {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await db.delete(hiringCandidate).where(eq(hiringCandidate.id, id));
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Hiring] Delete candidate error:', err.message);
    return NextResponse.json({ error: 'Failed to delete candidate' }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}
