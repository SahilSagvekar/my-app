export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { remindSignWellDocument } from '@/lib/signwell';

// POST /api/contracts/[id]/remind
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const contract = await prisma.contract.findUnique({ where: { id } });

    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    if (!contract.signwellDocumentId) {
      return NextResponse.json({ error: 'No SignWell document linked' }, { status: 400 });
    }

    if (['COMPLETED', 'CANCELLED', 'EXPIRED'].includes(contract.status)) {
      return NextResponse.json({ error: 'Contract is not in a signable state' }, { status: 400 });
    }

    await remindSignWellDocument(contract.signwellDocumentId);

    await prisma.contractAuditLog.create({
      data: {
        contractId: id,
        action: 'reminder_sent',
        performedBy: user.name || user.email,
        details: JSON.stringify({ via: 'signwell' }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('POST /api/contracts/[id]/remind error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
