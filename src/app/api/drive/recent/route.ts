export const dynamic = 'force-dynamic';
// src/app/api/drive/recent/route.ts
// GET ?role=&clientId= — newest files first across everything this user can
// see (or just the open client when clientId is given). Index-only.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { resolveDriveScope } from '@/lib/drive/access';
import { isDriveIndexEnabled, listRecent } from '@/lib/drive/index-store';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isDriveIndexEnabled()) return NextResponse.json({ enabled: false, items: [] });
  const sp = req.nextUrl.searchParams;
  const scope = await resolveDriveScope(user, sp.get('role'), sp.get('clientId'));
  try {
    const items = await listRecent({
      allowedPrefixes: scope.allowedPrefixes,
      prefix: scope.prefix || undefined,
      userId: user.id,
      limit: Math.min(parseInt(sp.get('limit') || '100', 10) || 100, 200),
    });
    return NextResponse.json({ enabled: true, items });
  } catch (err: any) {
    console.error('[drive/recent] failed:', err);
    return NextResponse.json({ error: 'Failed to load recent files' }, { status: 500 });
  }
}
