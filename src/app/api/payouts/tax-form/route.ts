export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { uploadBufferToS3, generateDownloadUrl } from '@/lib/s3';
import { fillW9Pdf, W9Input } from '@/lib/tax-form';

const SALES_ROLES = ['sales', 'sales_manager'];

// GET /api/payouts/tax-form — current rep's tax form status + download link
export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.salesRepPayoutProfile.findUnique({ where: { userId: user.id } });

  let downloadUrl: string | null = null;
  if (profile?.taxFormS3Key) {
    downloadUrl = await generateDownloadUrl(profile.taxFormS3Key, `${profile.taxFormType || 'W9'}-${user.id}.pdf`, 3600);
  }

  return NextResponse.json({
    success: true,
    data: {
      submitted: !!profile?.taxFormCollectedAt,
      taxFormType: profile?.taxFormType ?? null,
      submittedAt: profile?.taxFormCollectedAt ?? null,
      downloadUrl,
    },
  });
}

// POST /api/payouts/tax-form — fill + submit W-9
export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!SALES_ROLES.includes(user.role ?? '') && user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }

  const {
    name,
    businessName,
    taxClassification,
    llcClassificationLetter,
    otherDescription,
    address,
    cityStateZip,
    ssn,
    ein,
    signedName,
  } = body as Partial<W9Input>;

  if (!name || !taxClassification || !address || !cityStateZip || !signedName) {
    return NextResponse.json(
      { success: false, error: 'Missing required W-9 fields' },
      { status: 400 }
    );
  }
  if (!ssn && !ein) {
    return NextResponse.json(
      { success: false, error: 'Either SSN or EIN is required' },
      { status: 400 }
    );
  }

  const signedDate = new Date().toLocaleDateString('en-US');

  try {
    const pdfBuffer = await fillW9Pdf({
      name,
      businessName,
      taxClassification,
      llcClassificationLetter,
      otherDescription,
      address,
      cityStateZip,
      ssn,
      ein,
      signedName,
      signedDate,
    });

    const { key } = await uploadBufferToS3({
      buffer: pdfBuffer,
      folderPrefix: `tax-forms/${user.id}/`,
      filename: `W9-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
    });

    await prisma.salesRepPayoutProfile.upsert({
      where: { userId: user.id },
      update: {
        taxFormType: 'W9',
        taxFormCollectedAt: new Date(),
        taxFormS3Key: key,
      },
      create: {
        userId: user.id,
        taxFormType: 'W9',
        taxFormCollectedAt: new Date(),
        taxFormS3Key: key,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[payouts/tax-form] failed to submit W-9:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to submit tax form', details: err.message },
      { status: 500 }
    );
  }
}
