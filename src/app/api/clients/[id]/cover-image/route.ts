export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/cover-image/route.ts
// Update requiresCoverImage for a client — drives the Scheduler's
// cover-image checkmark on that client's Short Form tasks.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromToken(request);
    const authError = requireAdmin(user);
    if (authError) {
      return NextResponse.json({ error: authError.error }, { status: authError.status });
    }

    const { id: clientId } = await params;
    const body = await request.json();
    const { requiresCoverImage } = body;

    if (typeof requiresCoverImage !== 'boolean') {
      return NextResponse.json(
        { error: 'requiresCoverImage must be boolean' },
        { status: 400 }
      );
    }

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: { requiresCoverImage },
      select: {
        id: true,
        requiresCoverImage: true,
        companyName: true,
        name: true,
      },
    });

    console.log(
      `✅ Client ${updatedClient.companyName || updatedClient.name} requiresCoverImage=${requiresCoverImage}`
    );

    return NextResponse.json({ success: true, client: updatedClient });
  } catch (error: any) {
    console.error('Update cover image setting error:', error);
    return NextResponse.json(
      { error: 'Failed to update cover image setting', details: error.message },
      { status: 500 }
    );
  }
}
