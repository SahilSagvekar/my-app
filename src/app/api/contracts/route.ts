export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { contract as contractTable, contractSigner as contractSignerTable } from '@/lib/db/schema';
import { and, or, eq, ilike, desc, inArray, isNull } from 'drizzle-orm';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { sendContractViaSignWell } from '@/lib/contracts';

// GET /api/contracts — list contracts
export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const clientId = searchParams.get('clientId');

    const conditions: any[] = [];

    if (user.role === 'admin' || user.role === 'manager') {
      if (status && status !== 'all') conditions.push(eq(contractTable.status, status as any));
      if (clientId) conditions.push(eq(contractTable.clientId, clientId));
    } else if (user.role === 'client') {
      const linkedClientId = await resolveClientIdForUser(user.id);

      const signerContractIdRows = await db
        .select({ contractId: contractSignerTable.contractId })
        .from(contractSignerTable)
        .where(eq(contractSignerTable.email, user.email));
      const signerContractIds = signerContractIdRows.map((r) => r.contractId);

      const orParts: any[] = [
        linkedClientId === null ? isNull(contractTable.clientId) : eq(contractTable.clientId, linkedClientId),
      ];
      if (signerContractIds.length > 0) orParts.push(inArray(contractTable.id, signerContractIds));
      conditions.push(or(...orParts));

      if (status && status !== 'all') conditions.push(eq(contractTable.status, status as any));
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (search) {
      conditions.push(
        or(ilike(contractTable.title, `%${search}%`), ilike(contractTable.description, `%${search}%`))
      );
    }

    const rows = await db.query.contract.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(contractTable.createdAt),
      with: {
        contractSigners: {
          columns: {
            id: true, name: true, email: true, status: true, role: true,
            signedAt: true, viewedAt: true, declinedAt: true, declineReason: true,
            ipAddress: true, userAgent: true,
          },
        },
        user: { columns: { id: true, name: true, email: true } },
        contractAuditLogs: { orderBy: (t: any, { asc }: any) => asc(t.createdAt) },
      },
    });

    const contracts = rows.map((c: any) => {
      const { contractSigners, contractAuditLogs, user: createdBy, ...rest } = c;
      return {
        ...rest,
        signers: contractSigners,
        createdBy,
        auditLogs: contractAuditLogs,
        fileSize: c.fileSize?.toString() || '0',
      };
    });

    return NextResponse.json(contracts);
  } catch (err: any) {
    console.error('GET /api/contracts error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}

// POST /api/contracts — create + send via SignWell
export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
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

    const full = await db.query.contract.findFirst({
      where: eq(contractTable.id, contract.id),
      with: {
        contractSigners: true,
        user: { columns: { id: true, name: true, email: true } },
      },
    });

    const { contractSigners, user: createdBy, ...rest } = full!;

    return NextResponse.json({
      ...rest,
      signers: contractSigners,
      createdBy,
      fileSize: String(full!.fileSize),
    }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/contracts error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}
