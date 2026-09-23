export const dynamic = 'force-dynamic';
// src/app/api/drive/trash/restore/route.ts
// POST { rootKeys: string[] } — put trashed items back exactly where they
// were. Instant: the bytes never left R2. Anyone who could have deleted the
// item may restore it.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { resolveDriveScope, canDeleteKey } from '@/lib/drive/access';
import { isDriveTrashEnabled, restoreTrashRoots, logDriveActivity } from '@/lib/drive/index-store';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isDriveTrashEnabled()) return NextResponse.json({ error: 'Trash is not enabled' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const rootKeys: string[] = Array.isArray(body?.rootKeys) ? body.rootKeys.filter((k: unknown) => typeof k === 'string' && k) : [];
  if (!rootKeys.length) return NextResponse.json({ error: 'No items given' }, { status: 400 });

  // Permission follows the user's real role, same as deleting did.
  const scope = await resolveDriveScope(user, user.role);
  const allowed: string[] = [];
  const denied: { rootKey: string; error: string }[] = [];
  for (const k of rootKeys) {
    const check = canDeleteKey(scope, k);
    if (check.ok) allowed.push(k);
    else denied.push({ rootKey: k, error: check.error });
  }

  const restored = await restoreTrashRoots(allowed);
  await logDriveActivity(allowed.map((k) => ({ key: k, action: 'restored', userId: user.id })));
  return NextResponse.json({ success: true, restoredItems: restored, restoredRoots: allowed, denied });
}
