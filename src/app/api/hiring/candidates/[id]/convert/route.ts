export const dynamic = 'force-dynamic';
// src/app/api/hiring/candidates/[id]/convert/route.ts
// Converts a HIRED candidate into a real employee (User) account.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { hiringCandidate, user as userTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { generateTempPassword, hashPassword } from '@/lib/password';

type Role = 'admin' | 'manager' | 'editor' | 'videographer' | 'scheduler' | 'client' | 'qc' | 'sales' | 'sales_manager';

const VALID_ROLES: Role[] = ['admin', 'manager', 'editor', 'videographer', 'scheduler', 'client', 'qc', 'sales', 'sales_manager'];

async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user || user.role?.toLowerCase() !== 'admin') return null;
  return user;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const role: Role = VALID_ROLES.includes(body.role) ? body.role : 'editor';

    const [candidate] = await db.select().from(hiringCandidate).where(eq(hiringCandidate.id, id)).limit(1);
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    if (candidate.status !== 'HIRED') {
      return NextResponse.json({ error: 'Only hired candidates (approved test task) can be converted' }, { status: 400 });
    }
    if (candidate.convertedUserId) {
      return NextResponse.json({ error: 'Candidate already converted to an employee' }, { status: 409 });
    }

    const [existing] = await db.select().from(userTable).where(eq(userTable.email, candidate.email)).limit(1);
    if (existing) {
      return NextResponse.json({ error: `A user with email ${candidate.email} already exists` }, { status: 409 });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    const [user] = await db.insert(userTable).values({
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone || undefined,
      password: hashedPassword,
      role,
      employeeStatus: 'ACTIVE',
      hoursPerWeek: String(40),
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    await db.update(hiringCandidate)
      .set({ convertedUserId: user.id, convertedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(hiringCandidate.id, candidate.id));

    const emailResult = await sendWelcomeEmail({
      email: candidate.email,
      name: candidate.name,
      role,
      tempPassword,
    });

    return NextResponse.json({ ok: true, user, email: emailResult });
  } catch (err: any) {
    console.error('[Hiring] Convert candidate error:', err.message);
    return NextResponse.json({ error: err.message || 'Failed to convert candidate' }, { status: 500 });
  }
}
