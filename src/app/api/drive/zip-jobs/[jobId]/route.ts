export const dynamic = 'force-dynamic';

// GET /api/drive/zip-jobs/[jobId]
//
// Fast poll for a "Download All" zip-build job's progress. The frontend
// calls this every few seconds while a job is running instead of holding
// its own long connection open — the actual multi-hour work happens in
// worker.ts's queue consumer -> file-server, entirely independent of
// whether the browser tab stays open or a poll happens to land or not.
//
// Once the job is done, this also resolves a presigned download URL for
// the finished zip so the frontend can trigger exactly one browser
// download — no more silently-blocked-past-6-files behavior.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { getZipJobStatus, presignDownload } from '@/lib/file-server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { env } = getCloudflareContext();
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { jobId } = await params;

  const status = await getZipJobStatus(env, user.id, user.role, jobId);
  if (!status) {
    // Row doesn't exist on the file server yet — the queue message hasn't
    // been picked up by worker.ts's consumer yet. Not an error; the
    // frontend should keep polling.
    return NextResponse.json({ status: 'queued' });
  }

  if (status.status === 'done' && status.resultKey) {
    const zipFileName = `${(status.zipName || 'download').replace(/\.zip$/, '')}.zip`;
    const { downloadUrl } = await presignDownload(env, user.id, user.role, status.resultKey, zipFileName);
    return NextResponse.json({ ...status, downloadUrl });
  }

  return NextResponse.json(status);
}