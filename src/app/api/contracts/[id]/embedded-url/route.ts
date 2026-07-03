export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { getSignWellDocument } from '@/lib/signwell';

// GET /api/contracts/[id]/embedded-url
// Returns the SignWell embedded signing URL for the current user (client)
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
    if (!contract.signwellDocumentId) {
      return NextResponse.json({ error: 'No SignWell document linked' }, { status: 400 });
    }

    if (contract.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Contract already signed' }, { status: 400 });
    }

    // Get fresh document data from SignWell (has latest embedded URLs)
    const doc = await getSignWellDocument(contract.signwellDocumentId);

    // Find the signer that matches the current user's email
    const swSigners = doc.recipients || doc.signers || [];
    const matchingSigner = swSigners.find(
      (s: any) => s.email?.toLowerCase() === user.email?.toLowerCase()
    );

    if (!matchingSigner) {
      return NextResponse.json({ error: 'You are not a signer on this contract' }, { status: 403 });
    }

    if (matchingSigner.status === 'signed' || matchingSigner.status === 'completed') {
      return NextResponse.json({ error: 'You have already signed this contract' }, { status: 400 });
    }

    const embeddedUrl = matchingSigner.embedded_signing_url;
    if (!embeddedUrl) {
      return NextResponse.json(
        { error: 'Embedded signing not available. Please use the email link to sign.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ embeddedUrl, signerId: matchingSigner.id });
  } catch (err: any) {
    console.error('GET /api/contracts/[id]/embedded-url error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
