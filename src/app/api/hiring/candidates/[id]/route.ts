export const dynamic = 'force-dynamic';
// src/app/api/hiring/candidates/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user || user.role?.toLowerCase() !== 'admin') return null;
  return user;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const candidate = await prisma.hiringCandidate.findUnique({
    where: { id },
    include: {
      testTasks: {
        orderBy: { createdAt: 'desc' },
        include: { reviewedBy: { select: { id: true, name: true } } },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (!candidate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ candidate });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { name, email, phone, portfolioUrl, resumeUrl, source, notes, status } = body;

  try {
    const candidate = await prisma.hiringCandidate.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(portfolioUrl !== undefined ? { portfolioUrl } : {}),
        ...(resumeUrl !== undefined ? { resumeUrl } : {}),
        ...(source !== undefined ? { source } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });
    return NextResponse.json({ candidate });
  } catch (err: any) {
    console.error('[Hiring] Update candidate error:', err.message);
    return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.hiringCandidate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Hiring] Delete candidate error:', err.message);
    return NextResponse.json({ error: 'Failed to delete candidate' }, { status: 500 });
  }
}
