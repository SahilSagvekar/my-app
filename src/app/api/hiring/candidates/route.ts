export const dynamic = 'force-dynamic';
// src/app/api/hiring/candidates/route.ts
// Admin-only candidate list + create for the editor hiring pipeline.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

  const candidates = await prisma.hiringCandidate.findMany({
    where: {
      ...(status ? { status: status as any } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    },
    include: {
      testTasks: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

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

    const candidate = await prisma.hiringCandidate.create({
      data: {
        name,
        email,
        phone: phone || null,
        portfolioUrl: portfolioUrl || null,
        resumeUrl: resumeUrl || null,
        source: source || null,
        notes: notes || null,
        createdById: user.id,
      },
    });

    return NextResponse.json({ candidate }, { status: 201 });
  } catch (err: any) {
    console.error('[Hiring] Create candidate error:', err.message);
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });
  }
}
