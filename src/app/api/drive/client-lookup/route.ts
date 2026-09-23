export const dynamic = 'force-dynamic';
// src/app/api/drive/client-lookup/route.ts
// Look up clientId by company name — used when admin needs to use RawFootageUploadDialog

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { client as clientTable } from '@/lib/db/schema';
import { or, sql } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const db = getDbHttp();
  try {
    // 🔒 Was callable without logging in (company name -> client id lookup).
    const currentUser = await getCurrentUser2(request);
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
}