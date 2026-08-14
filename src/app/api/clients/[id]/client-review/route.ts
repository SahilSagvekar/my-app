export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/client-review/route.ts
// Update requiresClientReview + clientReviewDeliverableTypes for a client

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { client } from '@/lib/db/schema';
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
    const { requiresClientReview, clientReviewDeliverableTypes } = body;

    if (typeof requiresClientReview !== 'boolean') {
      return NextResponse.json(
        { error: 'requiresClientReview must be boolean' },
        { status: 400 }
      );
    }

    if (!Array.isArray(clientReviewDeliverableTypes)) {
      return NextResponse.json(
        { error: 'clientReviewDeliverableTypes must be an array' },
        { status: 400 }
      );
    }

    const [updatedClient] = await db.update(client).set({
      requiresClientReview,
      // If review is disabled, clear the types list
      clientReviewDeliverableTypes: requiresClientReview
        ? clientReviewDeliverableTypes
        : [],
      updatedAt: new Date().toISOString(),
    }).where(eq(client.id, clientId)).returning({
      id: client.id,
      requiresClientReview: client.requiresClientReview,
      clientReviewDeliverableTypes: client.clientReviewDeliverableTypes,
      companyName: client.companyName,
      name: client.name,
    });

    console.log(
      `✅ Client ${updatedClient.companyName || updatedClient.name} ` +
      `clientReview=${requiresClientReview}, ` +
      `types=[${clientReviewDeliverableTypes.join(', ')}]`
    );

    return NextResponse.json({ success: true, client: updatedClient });
  } catch (error: any) {
    console.error('Update client review settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update client review settings', details: error.message },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}