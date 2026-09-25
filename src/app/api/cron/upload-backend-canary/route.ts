// src/app/api/cron/upload-backend-canary/route.ts
// Scheduled job (every 15 min, see cron-master.ts) — real end-to-end
// exercise of the backup bucket: writes a tiny object, verifies it,
// deletes it. This is what lets the admin trust the "Primary/Backup"
// switch works before they're ever forced to flip it under pressure.
// Failure posts to Slack immediately so a broken backup bucket doesn't
// stay unnoticed until the day it's actually needed.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { generateFileServerToken } from '@/lib/file-server';
import { recordCanaryResult } from '@/lib/upload-backend';
import { sendToChannel } from '@/lib/slack';

const FILE_SERVER_ORIGIN = 'https://e8-file-server';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  const cookieHeader = req.headers.get('cookie');
  const match = cookieHeader?.match(/authToken=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.role?.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { env } = getCloudflareContext();

  try {
    const token = generateFileServerToken('system', 'admin');
    const res = await (env as any).FILE_SERVER.fetch(`${FILE_SERVER_ORIGIN}/backup-bucket/canary`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body: any = await res.json().catch(() => ({}));

    if (!res.ok || !body.ok) {
      const errorMsg = body.error || `File server error: ${res.status}`;
      await recordCanaryResult(false, errorMsg);
      sendToChannel('e8app', {
        type: 'upload_backend_canary_failed',
        message: `🚨 *Backup bucket canary failed*: ${errorMsg}\nThe backup bucket may not be usable right now — check before relying on the Primary/Backup switch.`,
      }).catch((e: any) => console.warn('[upload-backend-canary] Slack notify failed:', e?.message));
      return NextResponse.json({ ok: false, error: errorMsg }, { status: 200 });
    }

    await recordCanaryResult(true);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('❌ /api/cron/upload-backend-canary error:', err.message);
    await recordCanaryResult(false, err.message).catch(() => {});
    sendToChannel('e8app', {
      type: 'upload_backend_canary_failed',
      message: `🚨 *Backup bucket canary failed*: ${err.message}\nThe backup bucket may not be usable right now — check before relying on the Primary/Backup switch.`,
    }).catch((e: any) => console.warn('[upload-backend-canary] Slack notify failed:', e?.message));
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 });
  }
}