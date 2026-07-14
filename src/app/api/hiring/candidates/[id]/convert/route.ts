export const dynamic = 'force-dynamic';
// src/app/api/hiring/candidates/[id]/convert/route.ts
// Converts a HIRED candidate into a real employee (User) account.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';
import { generateTempPassword, hashPassword } from '@/lib/password';
import { Role } from '@prisma/client';

const VALID_ROLES: Role[] = ['admin', 'manager', 'editor', 'videographer', 'scheduler', 'client', 'qc', 'sales', 'sales_manager'];

async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user || user.role?.toLowerCase() !== 'admin') return null;
  return user;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const role: Role = VALID_ROLES.includes(body.role) ? body.role : 'editor';

    const candidate = await prisma.hiringCandidate.findUnique({ where: { id } });
    if (!candidate) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    if (candidate.status !== 'HIRED') {
      return NextResponse.json({ error: 'Only hired candidates (approved test task) can be converted' }, { status: 400 });
    }
    if (candidate.convertedUserId) {
      return NextResponse.json({ error: 'Candidate already converted to an employee' }, { status: 409 });
    }

    const existing = await prisma.user.findFirst({ where: { email: candidate.email } });
    if (existing) {
      return NextResponse.json({ error: `A user with email ${candidate.email} already exists` }, { status: 409 });
    }

    const tempPassword = generateTempPassword();
    const hashedPassword = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone || undefined,
        password: hashedPassword,
        role,
        employeeStatus: 'ACTIVE',
        hoursPerWeek: 40,
        joinedAt: new Date(),
      },
    });

    await prisma.hiringCandidate.update({
      where: { id: candidate.id },
      data: { convertedUserId: user.id, convertedAt: new Date() },
    });

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
