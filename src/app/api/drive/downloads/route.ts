export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { driveFileDownload as downloadTable, user as userTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq, sql } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

// Same viewer set as /api/drive/notes and /api/drive/editor-assignments —
// internal coordination, not something clients need to see about their own
// portal activity.
const CAN_VIEW = ['admin', 'manager', 'scheduler', 'videographer', 'editor'];

// GET /api/drive/downloads?clientId=... — every file's download
// history for this client, grouped by s3Key. Same "fetch the whole map
// once" shape as the other drive-metadata routes so the UI can badge every
// visible row without a request per item.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!CAN_VIEW.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'clientId is required' }, { status: 400 });

    const rows = await db.query.driveFileDownload.findMany({
      where: eq(downloadTable.clientId, clientId),
      orderBy: (t, { asc }) => [asc(t.firstDownloadedAt)],
      with: { user: { columns: { id: true, name: true, email: true } } },
    });

    const downloads: Record<string, { userId: number; name: string; count: number; lastDownloadedAt: string }[]> = {};
    for (const row of rows) {
      const key = row.s3Key;
      if (!downloads[key]) downloads[key] = [];
      downloads[key].push({
        userId: row.userId,
        name: row.user?.name || row.user?.email || `User ${row.userId}`,
        count: row.downloadCount,
        lastDownloadedAt: row.lastDownloadedAt,
      });
    }
    // Most recent downloader first within each file, so the badge shows
    // whoever grabbed it last.
    for (const key of Object.keys(downloads)) {
      downloads[key].sort((a, b) => b.lastDownloadedAt.localeCompare(a.lastDownloadedAt));
    }

    return NextResponse.json({ downloads });
  } catch (error: any) {
    console.error('[Drive Downloads] GET error:', error);
    return NextResponse.json({ error: 'Failed to load download history' }, { status: 500 });
  }
}

// POST — record that the current user just downloaded one or more files.
// Fired at the moment a download is triggered (single-file, or an explicit
// multi-file selection), not after a zip finishes building — a multi-GB zip
// can take a long time server-side, and "who kicked this off" is the useful
// signal here, same as any other "download started" log. Folder-level zips
// (Download All / download a whole folder) aren't recorded per-file, since
// the file server enumerates those contents itself and the browser never
// sees the individual keys — see DriveExplorer's comment at the call site.
// body: { clientId, s3Keys: string[] }
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { clientId, s3Keys } = body;
    if (!clientId || !Array.isArray(s3Keys) || s3Keys.length === 0) {
      return NextResponse.json({ error: 'clientId and s3Keys[] are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    for (const s3Key of s3Keys as string[]) {
      await db
        .insert(downloadTable)
        .values({
          id: createId(),
          clientId,
          s3Key,
          userId: user.id,
          downloadCount: 1,
          lastDownloadedAt: now,
        })
        .onConflictDoUpdate({
          target: [downloadTable.clientId, downloadTable.s3Key, downloadTable.userId],
          set: { downloadCount: sql`${downloadTable.downloadCount} + 1`, lastDownloadedAt: now },
        });
    }

    return NextResponse.json({
      ok: true,
      downloaderName: user.name || user.email || `User ${user.id}`,
    });
  } catch (error: any) {
    console.error('[Drive Downloads] POST error:', error);
    // Best-effort — never block an actual download over a logging failure.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}