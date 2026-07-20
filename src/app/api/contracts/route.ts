export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { sendContractViaSignWell } from '@/lib/contracts';

// GET /api/contracts — list contracts
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const clientId = searchParams.get('clientId');

    let where: any = {};

    if (user.role === 'admin' || user.role === 'manager') {
      if (status && status !== 'all') where.status = status;
      if (clientId) where.clientId = clientId;
    } else if (user.role === 'client') {
      const clientId = await resolveClientIdForUser(user.id);
      where.OR = [
        { clientId },
        { signers: { some: { email: user.email } } },
      ];
      if (status && status !== 'all') where.status = status;
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (search) {
      const searchFilter = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchFilter }];
        delete where.OR;
      } else {
        where.OR = searchFilter;
      }
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        signers: {
          select: {
            id: true, name: true, email: true, status: true, role: true,
            signedAt: true, viewedAt: true, declinedAt: true, declineReason: true,
            ipAddress: true, userAgent: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
        auditLogs: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(
      contracts.map((c: any) => ({ ...c, fileSize: c.fileSize?.toString() || '0' }))
    );
  } catch (err: any) {
    console.error('GET /api/contracts error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/contracts — create + send via SignWell
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const message = formData.get('message') as string | null;
    const clientId = formData.get('clientId') as string | null;
    const expiresInDays = Number(formData.get('expiresInDays') || 30);
    const signersJson = formData.get('signers') as string;

    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
    if (!signersJson) return NextResponse.json({ error: 'At least one signer is required' }, { status: 400 });

    let signers: Array<{ name: string; email: string }> = [];
    try { signers = JSON.parse(signersJson); } catch {
      return NextResponse.json({ error: 'Invalid signers JSON' }, { status: 400 });
    }

    if (signers.length === 0) {
      return NextResponse.json({ error: 'At least one signer is required' }, { status: 400 });
    }

    // 1. Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 2-4. Upload to R2, send to SignWell, create Contract + signers + audit log
    const contract = await sendContractViaSignWell({
      buffer,
      fileName: file.name,
      title,
      description,
      message: message || undefined,
      clientId,
      createdById: user.id,
      signers,
      expiresInDays,
      performedBy: user.name || user.email,
    });

    const full = await prisma.contract.findUnique({
      where: { id: contract.id },
      include: {
        signers: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      ...full,
      fileSize: full!.fileSize.toString(),
    }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/contracts error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
