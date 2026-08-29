export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { presignDownload } from '@/lib/file-server';
import { getDbHttp } from '@/lib/db';
import { file as fileTable, nasBackupRecord } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function POST(req: NextRequest) {
  const { env } = getCloudflareContext();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { s3Key, fileName } = await req.json();
    if (!s3Key) return NextResponse.json({ error: 'Missing s3Key' }, { status: 400 });

    // Check tracking first — cheaper than probing R2, and this is the
    // source of truth for "does R2 still have this" per the delete-time
    // sync (see /api/drive/delete). Only NAS-only files hit this branch.
    const db = getDbHttp();
    const [fileRow] = await db.select({ deletedFromCloud: fileTable.deletedFromCloud })
      .from(fileTable).where(eq(fileTable.s3Key, s3Key)).limit(1);
    const [recordRow] = fileRow ? [] : await db.select({ deletedFromCloud: nasBackupRecord.deletedFromCloud })
      .from(nasBackupRecord).where(eq(nasBackupRecord.s3Key, s3Key)).limit(1);
    const trackedRow = fileRow || recordRow;

    if (trackedRow?.deletedFromCloud) {
      // No native presigning on the NAS side — point the browser at our
      // own same-origin streaming route instead (cookie-authenticated,
      // proxies to e8-file-server server-to-server).
      const params = new URLSearchParams({ s3Key, ...(fileName ? { fileName } : {}) });
      return NextResponse.json({ downloadUrl: `/api/drive/nas-stream?${params.toString()}`, source: 'nas' });
    }

    const { downloadUrl } = await presignDownload(env, user.id, user.role, s3Key, fileName);
    return NextResponse.json({ downloadUrl, source: 'r2' });
  } catch (err: any) {
    console.error('Drive download error:', err);
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }
}