export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { uploadBufferToS3 } from '@/lib/s3';

const CAN_CONFIRM = ['admin', 'manager', 'videographer'];

// POST — upload a photo confirming equipment was put back, for this shoot
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_CONFIRM.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: taskId } = params;
    const [existingShoot] = await db.select({ id: shootDetailTable.id })
      .from(shootDetailTable).where(eq(shootDetailTable.taskId, taskId)).limit(1);
    if (!existingShoot) {
      return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const photo = formData.get('photo') as File | null;
    if (!photo) {
      return NextResponse.json({ error: 'A photo is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase();
    const uploaded = await uploadBufferToS3({
      buffer,
      folderPrefix: `equipment-returns/${taskId}/`,
      filename: `returned-${Date.now()}.${ext}`,
      mimeType: photo.type || 'image/jpeg',
    });

    const [updated] = await db.update(shootDetailTable).set({
      equipmentReturnedPhotoUrl: uploaded.url,
      equipmentReturnedAt: new Date().toISOString(),
      equipmentReturnedBy: user.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(shootDetailTable.taskId, taskId)).returning();

    return NextResponse.json({ shootDetail: updated });
  } catch (error: any) {
    console.error('[Shoots] Equipment return error:', error);
    return NextResponse.json({ error: 'Failed to confirm equipment return' }, { status: 500 });
  }
}