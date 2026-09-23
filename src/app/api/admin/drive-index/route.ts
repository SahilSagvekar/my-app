export const dynamic = 'force-dynamic';
// src/app/api/admin/drive-index/route.ts
//
// Admin controls for the Files & Drive index.
//   GET                                   — sync status + row counts (is the backfill done?)
//   POST { action: 'sync', prefix? }      — start a reconcile/backfill run now
//                                           (the every-minute drive tick advances it;
//                                           pass `step: true` to also advance it in
//                                           this request, ~25s)
//   POST { action: 'queue-previews', prefix, onlyOutputs? }
//                                         — queue HLS previews for existing videos
//
// The very first backfill also starts on its own from the drive tick after
// deploy, so calling this is optional.

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import {
  continueIndexSync,
  getLatestSyncRun,
  isDriveIndexEnabled,
  isDrivePreviewsEnabled,
  isDriveTrashEnabled,
  startIndexSync,
} from '@/lib/drive/index-store';
import { queuePreviewsUnder } from '@/lib/drive/preview-jobs';

async function requireAdmin(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ error: 'Admins only' }, { status: 403 }) };
  return { user };
}

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin(req);
  if (error) return error;
  const db = getDbHttp();
  const counts = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE "removedAt" IS NULL AND NOT "pending")::int AS "live",
      count(*) FILTER (WHERE "removedAt" IS NULL AND "storageTier" = 'nas')::int AS "archived",
      count(*) FILTER (WHERE "trashedAt" IS NOT NULL AND "removedAt" IS NULL)::int AS "trashed",
      count(*) FILTER (WHERE "pending")::int AS "pending",
      count(*) FILTER (WHERE "removedAt" IS NOT NULL)::int AS "tombstones",
      count(*) FILTER (WHERE "previewStatus" = 'ready')::int AS "previewsReady",
      count(*) FILTER (WHERE "previewStatus" = 'queued')::int AS "previewsQueued",
      count(*) FILTER (WHERE "previewStatus" = 'processing')::int AS "previewsProcessing",
      count(*) FILTER (WHERE "previewStatus" = 'failed')::int AS "previewsFailed",
      max("updatedAt") AS "lastUpdate"
    FROM "DriveItem"
  `);
  return NextResponse.json({
    flags: {
      DRIVE_INDEX_ENABLED: isDriveIndexEnabled(),
      trash: isDriveTrashEnabled(),
      previews: isDrivePreviewsEnabled(),
    },
    latestRun: await getLatestSyncRun(),
    counts: (counts as any).rows?.[0] || null,
  });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin(req);
  if (error) return error;
  const body = await req.json().catch(() => ({}));

  if (body?.action === 'queue-previews') {
    const prefix = typeof body.prefix === 'string' ? body.prefix : '';
    if (!prefix) return NextResponse.json({ error: 'prefix is required (e.g. "Acme/")' }, { status: 400 });
    const queued = await queuePreviewsUnder(prefix, body.onlyOutputs !== false);
    return NextResponse.json({ queued });
  }

  if (body?.action === 'sync') {
    const prefix = typeof body.prefix === 'string' ? body.prefix : '';
    let run = await startIndexSync(prefix, `admin:${user!.id}`);
    if (body.step) {
      const { env } = getCloudflareContext();
      run = (await continueIndexSync(env, 25_000)) || run;
    }
    return NextResponse.json({ run });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
