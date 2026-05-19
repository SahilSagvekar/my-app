export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const cursor = url.searchParams.get('cursor'); // last uploadedAt for pagination
    const limit = 50;

    const files = await prisma.file.findMany({
      where: {
        uploadedBy: user.id,
        isActive: undefined, // include all — active and replaced
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit + 1, // fetch one extra to detect if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        name: true,
        mimeType: true,
        size: true,
        uploadedAt: true,
        folderType: true,
        version: true,
        isActive: true,
        taskId: true,
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            client: {
              select: {
                name: true,
                companyName: true,
              },
            },
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
        uploadedAt: f.uploadedAt.toISOString(),
        folderType: f.folderType || 'main',
        version: f.version,
        isActive: f.isActive,
        taskId: f.taskId,
        taskTitle: f.task?.title || 'Unknown Task',
        taskStatus: f.task?.status || '',
        clientName: f.task?.client?.companyName || f.task?.client?.name || 'Unknown Client',
      })),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error('[GET /api/editor/upload-history]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}