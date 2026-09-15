export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/scripts-required/route.ts
// Update Client.scriptsRequired — toggles whether the monthly generation
// run (generateMonthlyTasksFromTemplate) also creates a DeliverableScript
// row for every SF/LF task it creates. Editor tasks + raw-footage folders
// generate regardless of this toggle.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { client } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const { id: clientId } = await params;
    const body = await request.json();
    const { scriptsRequired } = body;

    if (typeof scriptsRequired !== 'boolean') {
      return NextResponse.json(
        { error: 'scriptsRequired must be a boolean' },
        { status: 400 }
      );
    }

    const [updatedClient] = await db.update(client).set({
      scriptsRequired,
      updatedAt: new Date().toISOString(),
    }).where(eq(client.id, clientId)).returning();

    if (!updatedClient) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client: updatedClient });
  } catch (error: unknown) {
    console.error('[Client Scripts Required] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update scripts required' }, { status: 500 });
  }
}
