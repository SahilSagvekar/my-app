export const dynamic = 'force-dynamic';
// src/app/api/drive/client-lookup/route.ts
// Look up clientId by company name — used when admin needs to use RawFootageUploadDialog

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { client as clientTable } from '@/lib/db/schema';
import { or, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { searchParams } = new URL(request.url);
    const companyName = searchParams.get('companyName');

    if (!companyName) {
      return NextResponse.json({ error: 'companyName required' }, { status: 400 });
    }

    const trimmed = companyName.trim();
    const [client] = await db
      .select({ id: clientTable.id, companyName: clientTable.companyName, name: clientTable.name })
      .from(clientTable)
      .where(
        or(
          sql`lower(${clientTable.companyName}) = lower(${trimmed})`,
          sql`lower(${clientTable.name}) = lower(${trimmed})`
        )
      )
      .limit(1);

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

  } finally {
    await closeDb();
  }
}