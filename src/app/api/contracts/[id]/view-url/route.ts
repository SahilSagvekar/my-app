export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { getSignWellDocument } from '@/lib/signwell';

// GET /api/contracts/[id]/view-url
// Returns a SignWell document viewer URL for the contract (read-only or signing).
// Admins/managers get the signing URL of the first pending signer (or any signer).
// Clients get their own signing URL if they have a pending signature, or a read-only redirect.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: { signers: true },
    });

    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });

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

    if (!contract.signwellDocumentId) {
      return NextResponse.json({ error: 'No SignWell document linked to this contract' }, { status: 400 });
    }

    // Fetch the live document from SignWell (has embedded_signing_url per signer)
    const doc = await getSignWellDocument(contract.signwellDocumentId);

    // Try to find an embedded signing URL for the current user first
    const swSigners = doc.recipients || doc.signers || [];
    const mySignerRecord = swSigners.find(
      (s: any) => s.email?.toLowerCase() === user.email?.toLowerCase()
    );

    if (mySignerRecord?.embedded_signing_url && mySignerRecord.status !== 'signed') {
      return NextResponse.json({
        viewUrl: mySignerRecord.embedded_signing_url,
        mode: 'sign',
      });
    }

    // For admins/managers or already-signed clients, return the first available embedded URL
    // This allows viewing the document in the iframe
    const anySignerUrl = swSigners.find((s: any) => s.embedded_signing_url)?.embedded_signing_url;

    if (anySignerUrl) {
      return NextResponse.json({
        viewUrl: anySignerUrl,
        mode: 'view',
        contractTitle: contract.title,
        status: contract.status,
      });
    }

    // Last resort: return the SignWell document page URL
    const signwellWebUrl = `https://www.signwell.com/documents/${contract.signwellDocumentId}`;
    return NextResponse.json({
      viewUrl: signwellWebUrl,
      mode: 'external',
      contractTitle: contract.title,
      status: contract.status,
    });
  } catch (err: any) {
    console.error('GET /api/contracts/[id]/view-url error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
