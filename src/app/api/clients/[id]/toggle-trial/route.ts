export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/toggle-trial/route.ts
// Toggle isTrial on client and bulk update all tasks for that client

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: { isTrial },
      select: { id: true, isTrial: true, companyName: true, name: true },
    });

    // Bulk update all monthly deliverables for this client
    const updateResult = await prisma.monthlyDeliverable.updateMany({
      where: { clientId },
      data: { isTrial },
    });

    console.log(
      `✅ Client ${updatedClient.companyName || updatedClient.name} trial=${isTrial}, ${updateResult.count} deliverables updated`
    );

    return NextResponse.json({
      success: true,
      client: updatedClient,
      deliverablesUpdated: updateResult.count,
    });
  } catch (error: any) {
    console.error('Toggle client trial error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle trial', details: error.message },
      { status: 500 }
    );
  }
}