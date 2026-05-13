export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/client-review/route.ts
// Update requiresClientReview + clientReviewDeliverableTypes for a client

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: {
        requiresClientReview,
        // If review is disabled, clear the types list
        clientReviewDeliverableTypes: requiresClientReview
          ? clientReviewDeliverableTypes
          : [],
      },
      select: {
        id: true,
        requiresClientReview: true,
        clientReviewDeliverableTypes: true,
        companyName: true,
        name: true,
      },
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
}