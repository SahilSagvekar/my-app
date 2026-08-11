export const dynamic = 'force-dynamic';
// src/app/api/hiring/candidates/route.ts
// Admin-only candidate list + create for the editor hiring pipeline.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hiringCandidate, hiringTestTask } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user || user.role?.toLowerCase() !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const conditions = [
    ...(status ? [eq(hiringCandidate.status, status as any)] : []),
    ...(search ? [or(ilike(hiringCandidate.name, `%${search}%`), ilike(hiringCandidate.email, `%${search}%`))!] : []),
  ];

  const candidateRows = await db.select().from(hiringCandidate)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(hiringCandidate.createdAt));

  const candidateIds = candidateRows.map(c => c.id);
  const testTaskRows = candidateIds.length
    ? await db.select().from(hiringTestTask)
      .where(inArray(hiringTestTask.candidateId, candidateIds))
      .orderBy(desc(hiringTestTask.createdAt))
    : [];

  // testTaskRows is already ordered desc by createdAt, so the first row seen
  // per candidateId is the latest one — matches Prisma's `take: 1` per-relation.
  const latestTestTaskByCandidate = new Map<string, typeof testTaskRows[number]>();
  for (const t of testTaskRows) {
    if (!latestTestTaskByCandidate.has(t.candidateId)) {
      latestTestTaskByCandidate.set(t.candidateId, t);
    }
  }

  const candidates = candidateRows.map(c => ({
    ...c,
    testTasks: latestTestTaskByCandidate.has(c.id) ? [latestTestTaskByCandidate.get(c.id)!] : [],
  }));

  return NextResponse.json({ candidates });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, email, phone, portfolioUrl, resumeUrl, source, notes } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'name and email are required' }, { status: 400 });
    }

    const [candidate] = await db.insert(hiringCandidate).values({
      id: createId(),
      name,
      email,
      phone: phone || null,
      portfolioUrl: portfolioUrl || null,
      resumeUrl: resumeUrl || null,
      source: source || null,
      notes: notes || null,
      createdById: user.id,
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({ candidate }, { status: 201 });
  } catch (err: any) {
    console.error('[Hiring] Create candidate error:', err.message);
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });
  }
}
