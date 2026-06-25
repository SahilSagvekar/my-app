export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { getSignWellDocument } from '@/lib/signwell';

// POST /api/contracts/[id]/send
// For SignWell: document was already sent on creation.
// This endpoint re-syncs status and returns the current SignWell document state.
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
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { signers: true },
    });

    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    if (!contract.signwellDocumentId) {
      return NextResponse.json({ error: 'No SignWell document linked to this contract' }, { status: 400 });
    }

    // Sync status from SignWell
    const doc = await getSignWellDocument(contract.signwellDocumentId);

    await prisma.contractAuditLog.create({
      data: {
        contractId: id,
        action: 'status_synced',
        performedBy: user.name || user.email,
        details: JSON.stringify({ signwellStatus: doc.status }),
      },
    });

    return NextResponse.json({ success: true, signwellStatus: doc.status, document: doc });
  } catch (err: any) {
    console.error('POST /api/contracts/[id]/send error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
