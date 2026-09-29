export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { equipment as equipmentTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { uploadBufferToS3 } from '@/lib/s3';

// Same rule as adding equipment itself: any signed-in team member can attach
// photos. Removing a photo is a delete, so it stays admin-only.
const CANNOT_ADD_IMAGES = ['client', 'host'];
const CAN_REMOVE_IMAGES = ['admin'];

// This route runs inside a Worker isolate (128MB), and every file is buffered
// in memory. The Equipment page uploads one file per request, so these caps
// are a guard against a hand-rolled request, not the normal path.
const MAX_FILES_PER_REQUEST = 5;
const MAX_BYTES_PER_FILE = 10 * 1024 * 1024; // 10 MB

function safeExtension(filename: string): string {
  const raw = (filename.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return raw && raw.length <= 5 ? raw : 'jpg';
}

// POST — attach one or more reference images to an equipment item
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (CANNOT_ADD_IMAGES.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    if (images.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        { error: `Send at most ${MAX_FILES_PER_REQUEST} images per request` },
        { status: 400 },
      );
    }

    const uploadedUrls: string[] = [];
    for (const image of images) {
      if (!image.type?.startsWith('image/')) continue;
      if (image.size > MAX_BYTES_PER_FILE) {
        return NextResponse.json(
          { error: `"${image.name}" is larger than ${MAX_BYTES_PER_FILE / (1024 * 1024)} MB` },
          { status: 413 },
        );
      }
      const buffer = Buffer.from(await image.arrayBuffer());
      const uploaded = await uploadBufferToS3({
        buffer,
        folderPrefix: `equipment-references/${params.id}/`,
        filename: `ref-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExtension(image.name)}`,
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
    if (!CAN_REMOVE_IMAGES.includes((user.role || '').toLowerCase())) {
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