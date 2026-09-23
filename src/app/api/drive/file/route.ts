export const dynamic = 'force-dynamic';
// src/app/api/drive/file/route.ts
//
// The `url` on every Drive file now points here instead of at a presigned
// R2 link baked into the folder tree (minting those for every file on every
// load was the slow part). The link carries a short-lived HMAC token scoped
// to this one key, so checking it costs no DB lookup.
//
//   ?k=<key>&e=<exp>&s=<sig>          open/preview: streamed from R2 with Range
//                                     support, so videos seek and PDFs/images
//                                     open inline
//   ...&dl=1&n=<name>                  download: 302 to a presigned R2 URL with
//                                     Content-Disposition: attachment, so the
//                                     browser downloads straight from R2
// Archived (NAS-only) files redirect to /api/drive/nas-stream.
// An expired token (tab open for 12h+) falls back to the session.

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { presignDownload } from '@/lib/file-server';
import { verifyDriveToken } from '@/lib/drive/url-tokens';
import { userCanAccessKey } from '@/lib/drive/access';
import { isInternalKey } from '@/lib/drive/keys';
import { serveR2Object } from '@/lib/drive/serve-r2';

async function authorize(req: NextRequest, key: string): Promise<NextResponse | null> {
  const sp = req.nextUrl.searchParams;
  if (await verifyDriveToken('file', key, sp.get('e'), sp.get('s'))) return null;
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Link expired — refresh the page' }, { status: 401 });
  if (!(await userCanAccessKey(user, key))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  return null;
}

async function storageTierOf(key: string): Promise<string> {
  try {
    const res = await getDbHttp().execute(sql`SELECT "storageTier" FROM "DriveItem" WHERE "key" = ${key} LIMIT 1`);
    return ((res as any).rows?.[0]?.storageTier as string) || 'r2';
  } catch {
    return 'r2'; // index not migrated yet — assume R2
  }
}

async function handle(req: NextRequest): Promise<Response> {
  const sp = req.nextUrl.searchParams;
  const key = sp.get('k') || '';
  if (!key || key.includes('..') || key.startsWith('/') || isInternalKey(key)) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }
  const denied = await authorize(req, key);
  if (denied) return denied;

  const name = sp.get('n') || key.split('/').pop() || 'file';
  if ((await storageTierOf(key)) === 'nas') {
    const params = new URLSearchParams({ s3Key: key, fileName: name });
    return NextResponse.redirect(new URL(`/api/drive/nas-stream?${params.toString()}`, req.url), 302);
  }

  if (sp.get('dl') === '1') {
    const { env } = getCloudflareContext();
    const { downloadUrl } = await presignDownload(env, 'system', 'admin', key, name);
    return NextResponse.redirect(downloadUrl, 302);
  }

  return serveR2Object(req, key, { disposition: 'inline', fileName: name });
}

export async function GET(req: NextRequest) {
  try {
    return await handle(req);
  } catch (err: any) {
    console.error('[drive/file] error:', err?.message);
    return NextResponse.json({ error: 'Could not open file' }, { status: 500 });
  }
}

export async function HEAD(req: NextRequest) {
  return GET(req);
}
