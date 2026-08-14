export const dynamic = 'force-dynamic';
// src/app/api/clients/[id]/cover-image/route.ts
// Update requiresCoverImage for a client — drives the Scheduler's
// cover-image checkmark on that client's Short Form tasks.

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { client } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
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

    const [updatedClient] = await db.update(client).set({
      requiresCoverImage,
      updatedAt: new Date().toISOString(),
    }).where(eq(client.id, clientId)).returning({
      id: client.id,
      requiresCoverImage: client.requiresCoverImage,
      companyName: client.companyName,
      name: client.name,
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

  } finally {
    await closeDb();
  }
}
