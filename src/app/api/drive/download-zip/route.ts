export const dynamic = 'force-dynamic';

// POST /api/drive/download-zip
//
// Kicks off an async "Download All" zip-build job and returns a jobId
// immediately — it does NOT wait for the zip to be built (that can take
// hours for a 100GB folder). The frontend polls
// GET /api/drive/zip-jobs/[jobId] for progress and gets a real download
// link once the job finishes.
//
// Previously this route generated a presigned download URL per file and
// had the browser download them one by one — Chrome silently blocks a
// page from triggering more than a handful of automatic downloads, so
// that approach quietly failed on anything past ~6 files. See
// /areas/download-all-zip-jobs for the full design writeup.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { enqueueZipJob, deliverZipJob } from '@/lib/zip-jobs-queue';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { isDriveTrashEnabled, trashedKeysUnder } from '@/lib/drive/index-store';
import { userCanAccessKey } from '@/lib/drive/access';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { keys, folderPrefix, zipName } = body as { keys?: string[]; folderPrefix?: string; zipName?: string };

  if (!keys?.length && !folderPrefix) {
    return NextResponse.json({ error: 'Provide keys[] or folderPrefix' }, { status: 400 });
  }

  // 🔒 Only zip what this user can see (previously any logged-in user could
  // zip any prefix or key list). Checked once per client folder, not per key.
  const topLevels = new Set<string>([
    ...(folderPrefix ? [folderPrefix] : []),
    ...((keys || []).map((k) => `${k.split('/')[0]}/`)),
  ]);
  for (const k of topLevels) {
    if (!(await userCanAccessKey(user, k))) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }
  }

  // Trashed files still exist in R2 for 30 days — leave them out of a
  // folder zip. (Capped so the queue message stays under its size limit;
  // a folder with more trashed files than that is vanishingly rare.)
  let excludeKeys: string[] | undefined;
  if (folderPrefix && isDriveTrashEnabled()) {
    try {
      const trashed = await trashedKeysUnder(folderPrefix.endsWith('/') ? folderPrefix : `${folderPrefix}/`, 500);
      if (trashed.length) excludeKeys = trashed;
    } catch (err: any) {
      console.warn('[download-zip] could not load trashed keys:', err?.message);
    }
  }

  const jobId = crypto.randomUUID();
  const job = { jobId, userId: user.id, role: user.role, keys, folderPrefix, zipName, excludeKeys };

  const queued = await enqueueZipJob(job);

  if (!queued) {
    // Local-dev fallback only — no queue binding available outside a
    // deployed Worker. Awaits the job inline, same as
    // notification-queue.ts's local fallback; fine for small test folders,
    // not representative of production behavior for large ones.
    const { env } = getCloudflareContext();
    try {
      await deliverZipJob(job, env);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Zip job failed' }, { status: 500 });
    }
  }

  console.log(`[download-zip] user=${user.id} | queued zip job ${jobId} for "${zipName || folderPrefix}"`);

  return NextResponse.json({ jobId });
}