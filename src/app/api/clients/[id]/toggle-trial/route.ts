export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/toggle-trial/route.ts
// Toggle isTrial on client and bulk update all tasks for that client

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { client, monthlyDeliverable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { id: clientId } = await params;
    const body = await request.json();
    const { isTrial } = body;

    if (typeof isTrial !== 'boolean') {
      return NextResponse.json(
        { error: 'isTrial must be boolean' },
        { status: 400 }
      );
    }

    // Update client
    const [updatedClient] = await db.update(client).set({
      isTrial,
      updatedAt: new Date().toISOString(),
    }).where(eq(client.id, clientId)).returning({
      id: client.id, isTrial: client.isTrial, companyName: client.companyName, name: client.name,
    });

    // Bulk update all monthly deliverables for this client
    const updateResult = await db.update(monthlyDeliverable).set({
      isTrial,
      updatedAt: new Date().toISOString(),
    }).where(eq(monthlyDeliverable.clientId, clientId)).returning({ id: monthlyDeliverable.id });

    console.log(
      `✅ Client ${updatedClient.companyName || updatedClient.name} trial=${isTrial}, ${updateResult.length} deliverables updated`
    );

    return NextResponse.json({
      success: true,
      client: updatedClient,
      deliverablesUpdated: updateResult.length,
    });
  } catch (error: any) {
    console.error('Toggle client trial error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle trial', details: error.message },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}