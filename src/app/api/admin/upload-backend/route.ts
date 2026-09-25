export const dynamic = 'force-dynamic';
// src/app/api/admin/upload-backend/route.ts
//
// Backs the admin "Primary/Backup" upload switch (UploadBackupAdmin.tsx).
// GET returns current status; POST flips the switch. Admin-only — this
// changes where new raw-footage/editor-output uploads get presigned to for
// every user in the org.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import {
  getUploadBackendStatus,
  setActiveUploadBackend,
  countFilesPendingMigration,
} from '@/lib/upload-backend';
import { sendToChannel } from '@/lib/slack';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const [status, pendingMigration] = await Promise.all([
      getUploadBackendStatus(),
      countFilesPendingMigration(),
    ]);

    return NextResponse.json({ ...status, pendingMigration });
  } catch (err: any) {
    console.error('[upload-backend GET]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { backend } = await req.json();
    if (backend !== 'r2' && backend !== 'backup') {
      return NextResponse.json({ error: "backend must be 'r2' or 'backup'" }, { status: 400 });
    }

    const before = await getUploadBackendStatus();
    if (before.activeBackend === backend) {
      return NextResponse.json({ ...before, pendingMigration: await countFilesPendingMigration() });
    }

    await setActiveUploadBackend(backend, Number(user.id));

    // Loud on purpose — this is a manual failover switch, so anyone
    // watching Slack should know immediately, not discover it later.
    sendToChannel('e8app', {
      type: 'upload_backend_switch',
      message:
        backend === 'backup'
          ? `🔴 *Upload backend switched to BACKUP* by ${user.name || user.email} — new raw footage/output uploads are now going to the backup R2 bucket. Files & Drive, QC/client streaming and thumbnails still depend on the primary bucket and are unaffected either way.`
          : `🟢 *Upload backend switched back to PRIMARY (r2)* by ${user.name || user.email} — new uploads are going to the primary bucket again. Files uploaded to the backup bucket will be migrated back automatically.`,
    }).catch((e: any) => console.warn('[upload-backend] Slack notify failed:', e?.message));

    // Auto-kick a migration sweep the moment we go back to primary — the
    // scheduled cron (every 5 min) would pick this up anyway, but firing
    // it immediately means the admin doesn't have to wait up to 5 minutes
    // after flipping the switch back to see progress start.
    if (backend === 'r2') {
      const { env } = getCloudflareContext();
      const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
      fetch(`${base}/api/cron/upload-backend-migrate`, {
        method: 'POST',
        headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
      }).catch((e) => console.warn('[upload-backend] Failed to kick off migration sweep:', e?.message));
    }

    const after = await getUploadBackendStatus();
    return NextResponse.json({ ...after, pendingMigration: await countFilesPendingMigration() });
  } catch (err: any) {
    console.error('[upload-backend POST]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}