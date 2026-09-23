export const dynamic = 'force-dynamic';
// src/app/api/drive/starred/route.ts
//   GET  ?role=&clientId=          — the user's starred files/folders (still existing, in scope)
//   POST { key, starred: boolean } — star / unstar
// Stars are per user and keyed by the item's R2 key; moves and renames
// carry them to the new key (see /api/drive/move and /api/drive/folder).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { resolveDriveScope, userCanAccessKey } from '@/lib/drive/access';
import { isDriveIndexEnabled, listStarred, setStar } from '@/lib/drive/index-store';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isDriveIndexEnabled()) return NextResponse.json({ enabled: false, items: [] });
  const sp = req.nextUrl.searchParams;
  const scope = await resolveDriveScope(user, sp.get('role'), sp.get('clientId'));
  try {
    const items = await listStarred({ allowedPrefixes: scope.allowedPrefixes, prefix: scope.prefix || undefined, userId: user.id });
    return NextResponse.json({ enabled: true, items });
  } catch (err: any) {
    console.error('[drive/starred] failed:', err);
    return NextResponse.json({ error: 'Failed to load starred items' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isDriveIndexEnabled()) return NextResponse.json({ error: 'Starring needs the Drive index' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const key = typeof body?.key === 'string' ? body.key : '';
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  if (!(await userCanAccessKey(user, key))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  await setStar(user.id, key, !!body.starred);
  return NextResponse.json({ success: true, key, starred: !!body.starred });
}
