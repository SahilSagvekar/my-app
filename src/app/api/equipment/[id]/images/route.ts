export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { equipment as equipmentTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { uploadBufferToS3 } from '@/lib/s3';

// Reference images are admin-only, unlike the equipment item itself (which
// videographers can create — see ../../route.ts).
const CAN_MANAGE_IMAGES = ['admin'];

// POST — upload one or more reference images for an equipment item (admin only)
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_MANAGE_IMAGES.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Only an admin can add reference images' }, { status: 403 });
    }

    const [existing] = await db.select({ id: equipmentTable.id, referenceImageUrls: equipmentTable.referenceImageUrls })
      .from(equipmentTable).where(eq(equipmentTable.id, params.id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const images = formData.getAll('images').filter((f): f is File => f instanceof File);
    if (images.length === 0) {
      return NextResponse.json({ error: 'At least one image is required' }, { status: 400 });
    }

    const uploadedUrls: string[] = [];
    for (const image of images) {
      if (!image.type?.startsWith('image/')) continue;
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = (image.name.split('.').pop() || 'jpg').toLowerCase();
      const uploaded = await uploadBufferToS3({
        buffer,
        folderPrefix: `equipment-references/${params.id}/`,
        filename: `ref-${Date.now()}-${uploadedUrls.length}.${ext}`,
        mimeType: image.type || 'image/jpeg',
      });
      uploadedUrls.push(uploaded.url);
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ error: 'No valid image files were provided' }, { status: 400 });
    }

    const nextUrls = [...(existing.referenceImageUrls || []), ...uploadedUrls];

    const [updated] = await db.update(equipmentTable)
      .set({ referenceImageUrls: nextUrls, updatedAt: new Date().toISOString() })
      .where(eq(equipmentTable.id, params.id))
      .returning();

    return NextResponse.json({ equipment: updated });
  } catch (error: any) {
    console.error('[Equipment] Image upload error:', error);
    return NextResponse.json({ error: 'Failed to upload reference images' }, { status: 500 });
  }
}

// DELETE — remove a single reference image by URL (admin only)
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_MANAGE_IMAGES.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Only an admin can remove reference images' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { url } = body;
    if (!url) {
      return NextResponse.json({ error: 'Image url is required' }, { status: 400 });
    }

    const [existing] = await db.select({ id: equipmentTable.id, referenceImageUrls: equipmentTable.referenceImageUrls })
      .from(equipmentTable).where(eq(equipmentTable.id, params.id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: 'Equipment not found' }, { status: 404 });
    }

    const nextUrls = (existing.referenceImageUrls || []).filter((u) => u !== url);

    const [updated] = await db.update(equipmentTable)
      .set({ referenceImageUrls: nextUrls, updatedAt: new Date().toISOString() })
      .where(eq(equipmentTable.id, params.id))
      .returning();

    return NextResponse.json({ equipment: updated });
  } catch (error: any) {
    console.error('[Equipment] Image delete error:', error);
    return NextResponse.json({ error: 'Failed to remove reference image' }, { status: 500 });
  }
}