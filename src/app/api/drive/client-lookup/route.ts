export const dynamic = 'force-dynamic';
// src/app/api/drive/client-lookup/route.ts
// Look up clientId by company name — used when admin needs to use RawFootageUploadDialog

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyName = searchParams.get('companyName');

    if (!companyName) {
      return NextResponse.json({ error: 'companyName required' }, { status: 400 });
    }

    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { companyName: companyName },
          { name: companyName },
        ]
      },
      select: { id: true, companyName: true, name: true },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({
      clientId: client.id,
      companyName: client.companyName || client.name,
    });

  } catch (error: any) {
    console.error('Client lookup error:', error);
    return NextResponse.json(
      { error: 'Lookup failed', details: error.message },
      { status: 500 }
    );
  }
}