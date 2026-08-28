export const dynamic = 'force-dynamic';

// GET /api/admin/editor-upload-history?editorId=123&cursor=...
//
// Admin/manager-only. Same query shape and cursor-pagination behavior as
// /api/editor/upload-history, but scoped to an arbitrary editor (by id)
// instead of the requesting user. Used by the "Editor Tracker" tab in
// ProductionTracker to let admins browse any editor's upload history.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable } from '@/lib/db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager', 'scheduler'].includes(user.role?.toLowerCase() || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const editorId = url.searchParams.get('editorId');
    if (!editorId) {
      return NextResponse.json({ error: 'Missing editorId' }, { status: 400 });
    }

    const cursor = url.searchParams.get('cursor'); // last uploadedAt for pagination
    const limit = 50;

    // Same row-value cursor comparison as /api/editor/upload-history — see
    // that route for the full explanation of why (matches Prisma's old
    // cursor-based pagination semantics for a non-unique orderBy field).
    let cursorCondition;
    if (cursor) {
      const [anchor] = await db.select({ uploadedAt: fileTable.uploadedAt })
        .from(fileTable).where(eq(fileTable.id, cursor)).limit(1);
      if (anchor) {
        cursorCondition = sql`(${fileTable.uploadedAt}, ${fileTable.id}) < (${anchor.uploadedAt}, ${cursor})`;
      }
    }

    const files = await db.query.file.findMany({
      where: and(
        eq(fileTable.uploadedBy, editorId),
        cursorCondition
      ),
      orderBy: [desc(fileTable.uploadedAt), desc(fileTable.id)],
      limit: limit + 1, // fetch one extra to detect if there's a next page
      columns: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        uploadedAt: true,
        folderType: true,
        version: true,
        isActive: true,
        taskId: true,
      },
      with: {
        task: {
          columns: { id: true, title: true, status: true },
          with: {
            client: { columns: { name: true, companyName: true } },
            monthlyDeliverable: { columns: { type: true } },
            oneOffDeliverable: { columns: { type: true } },
          },
        },
      },
    });

    const hasMore = files.length > limit;
    const items = hasMore ? files.slice(0, limit) : files;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return NextResponse.json({
      files: items.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType || '',
        size: Number(f.size),
        uploadedAt: new Date(f.uploadedAt).toISOString(),
        folderType: f.folderType || 'main',
        version: f.version,
        isActive: f.isActive,
        taskId: f.taskId,
        taskTitle: f.task?.title || 'Untitled Task',
        taskStatus: f.task?.status || '',
        clientName: f.task?.client?.companyName || f.task?.client?.name || 'Unknown Client',
      })),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error('[GET /api/admin/editor-upload-history]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}