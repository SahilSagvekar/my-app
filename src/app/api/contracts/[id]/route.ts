export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

// GET /api/contracts/[id] — get a single contract by ID
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: contractId } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        signers: true,
        createdBy: {
          select: { id: true, name: true, email: true }
        }
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    if (contract.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: contract.clientId },
        select: { id: true, name: true, companyName: true, email: true }
      });
      (contract as any).client = client;
    }

    // Access check
    if (user.role === 'client') {
      const isSigner = (contract as any).signers.some((s: any) => s.email === user.email);
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
