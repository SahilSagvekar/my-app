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
    const [existingShoot] = await db.select({ id: shootDetailTable.id, equipmentIds: shootDetailTable.equipmentIds })
      .from(shootDetailTable).where(eq(shootDetailTable.taskId, taskId)).limit(1);
    if (!existingShoot) {
      return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
    }

    const equipmentCount = (existingShoot.equipmentIds || []).length;
    if (equipmentCount === 0) {
      return NextResponse.json({ error: 'This shoot has no equipment to confirm' }, { status: 400 });
    }

    const formData = await req.formData();
    const photos = formData.getAll('photos').filter((p): p is File => p instanceof File);
    if (photos.length !== equipmentCount) {
      return NextResponse.json({
        error: `Expected ${equipmentCount} photo${equipmentCount === 1 ? '' : 's'} (one per equipment item), got ${photos.length}`,
      }, { status: 400 });
    }

    const uploadedUrls: string[] = [];
    for (const photo of photos) {
      const buffer = Buffer.from(await photo.arrayBuffer());
      const ext = (photo.name.split('.').pop() || 'jpg').toLowerCase();
      const uploaded = await uploadBufferToS3({
        buffer,
        folderPrefix: `equipment-returns/${taskId}/`,
        filename: `returned-${Date.now()}-${uploadedUrls.length}.${ext}`,
        mimeType: photo.type || 'image/jpeg',
      });
      uploadedUrls.push(uploaded.url);
    }

    const [updated] = await db.update(shootDetailTable).set({
      equipmentReturnedPhotoUrls: uploadedUrls,
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