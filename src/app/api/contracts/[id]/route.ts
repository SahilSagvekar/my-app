export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { contract as contractTable, client as clientTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// GET /api/contracts/[id] — get a single contract by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: contractId } = await params;

    const found = await db.query.contract.findFirst({
      where: eq(contractTable.id, contractId),
      with: {
        contractSigners: true,
        user: { columns: { id: true, name: true, email: true } },
      },
    });

    if (!found) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const { contractSigners, user: createdBy, ...rest } = found;
    const contract: any = { ...rest, signers: contractSigners, createdBy };

    if (contract.clientId) {
      const [client] = await db
        .select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName, email: clientTable.email })
        .from(clientTable)
        .where(eq(clientTable.id, contract.clientId))
        .limit(1);
      contract.client = client ?? null;
    }

    // Access check
    if (user.role === 'client') {
      const isSigner = contract.signers.some((s: any) => s.email === user.email);
      const isClient = contract.clientId === user.linkedClientId;
      if (!isSigner && !isClient) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      ...contract,
      fileSize: contract.fileSize?.toString() || '0',
    });
  } catch (err: any) {
    console.error(`GET /api/contracts/[id] error:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
