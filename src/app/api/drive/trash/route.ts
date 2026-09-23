export const dynamic = 'force-dynamic';
// src/app/api/drive/trash/route.ts
//
// GET — the Trash view: everything deleted in the last 30 days that this
// user can see, grouped by what was actually deleted (a folder shows once,
// with its item count). Deleting still goes through /api/drive/delete and
// /api/drive/bulk-delete, which move items here when Trash is on.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { resolveDriveScope } from '@/lib/drive/access';
import { isDriveTrashEnabled, listTrash, TRASH_RETENTION_DAYS } from '@/lib/drive/index-store';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isDriveTrashEnabled()) return NextResponse.json({ enabled: false, items: [] });

  const sp = req.nextUrl.searchParams;
  const scope = await resolveDriveScope(user, sp.get('role'), sp.get('clientId'));
  try {
    const items = await listTrash({ allowedPrefixes: scope.allowedPrefixes, prefix: scope.prefix || undefined });
    return NextResponse.json({
      enabled: true,
      retentionDays: TRASH_RETENTION_DAYS,
      canRestore: scope.role !== 'editor',
      canPurge: user.role === 'admin',
      items,
    });
  } catch (err: any) {
    console.error('[drive/trash] list failed:', err);
    return NextResponse.json({ error: 'Failed to load trash' }, { status: 500 });
  }
}
