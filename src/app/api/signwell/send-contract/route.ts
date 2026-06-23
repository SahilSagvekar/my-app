export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { createSignWellDocument, buildContractFields } from '@/lib/signwell';

// POST /api/signwell/send-contract
// Called after client sets password (CONTRACT_PENDING state)
// Can be triggered by the system automatically or by admin manually
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);

    const body = await req.json();
    const { clientId } = body;

    // Allow admin trigger OR system call (no user for system)
    if (user && !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!clientId) {
      return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        portalAccess: true,
        preClientId: false,
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (!client.portalAccess) {
      return NextResponse.json({ error: 'No portal access record' }, { status: 400 });
    }

    // Get the accepted quote for merge fields
    const preClient = client.preClientId
      ? await prisma.preClient.findUnique({
          where: { id: client.preClientId },
          include: {
            quotes: {
              where: { status: 'ACCEPTED' },
              orderBy: { version: 'desc' },
              take: 1,
            },
          },
        })
      : null;

    const acceptedQuote = preClient?.quotes[0];
    const templateId = process.env.SIGNWELL_TEMPLATE_ID;

    if (!templateId) {
      return NextResponse.json({ error: 'SIGNWELL_TEMPLATE_ID not configured' }, { status: 500 });
    }

    const fields = buildContractFields({
      clientName: client.name,
      companyName: client.companyName,
      email: client.email,
      totalAmount: acceptedQuote?.totalAmount ?? 0,
      services: (acceptedQuote?.services as any[]) ?? [],
      startDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    });

    // Create the SignWell document from template
    const doc = await createSignWellDocument({
      templateId,
      subject: `Your E8 Productions Service Agreement — ${client.companyName || client.name}`,
      message: `Hi ${client.name}, please review and sign your service agreement with E8 Productions. Once signed, you'll be directed to complete your first payment and unlock your portal.`,
      signers: [
        {
          id: '1',
          name: client.name,
          email: client.email,
          send_email: true,
        },
      ],
      fields,
    });

    // Save SignWell doc ID to the Contract record (create one if needed)
    const existingContract = await prisma.contract.findFirst({
      where: { clientId, preClientId: client.preClientId },
    });

    if (existingContract) {
      await prisma.contract.update({
        where: { id: existingContract.id },
        data: {
          signwellRequestId: doc.id,
          status: 'SENT',
        },
      });
    } else {
      // Create a placeholder contract record
      await prisma.contract.create({
        data: {
          title: `Service Agreement — ${client.companyName || client.name}`,
          clientId,
          preClientId: client.preClientId,
          signwellRequestId: doc.id,
          signwellDocumentId: doc.id,
          status: 'SENT',
          s3Key: '',       // will be filled when signed PDF is saved
          fileName: `service-agreement-${client.name.toLowerCase().replace(/\s+/g, '-')}.pdf`,
          fileSize: BigInt(0),
          createdById: 1,  // system user — adjust to your admin user ID
        },
      });
    }

    console.log(`✅ [SignWell] Contract sent to ${client.email} | doc: ${doc.id}`);

    return NextResponse.json({ success: true, documentId: doc.id });
  } catch (err: any) {
    console.error('POST /api/signwell/send-contract error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
