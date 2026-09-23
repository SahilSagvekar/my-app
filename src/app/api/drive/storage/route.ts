export const dynamic = 'force-dynamic';
// src/app/api/drive/storage/route.ts
// GET — storage used per client from the Drive index (live in R2, archived
// on the NAS, sitting in Trash, raw footage vs deliverables). Staff only;
// clients keep their existing quota meter (/api/clients/[id]/storage).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { resolveDriveScope } from '@/lib/drive/access';
import { isDriveIndexEnabled, storageByClient } from '@/lib/drive/index-store';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!isDriveIndexEnabled()) return NextResponse.json({ enabled: false, clients: [] });
  const scope = await resolveDriveScope(user, req.nextUrl.searchParams.get('role'));
  if (scope.role === 'client') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  try {
    const clients = await storageByClient(scope.allowedPrefixes);
    return NextResponse.json({ enabled: true, clients });
  } catch (err: any) {
    console.error('[drive/storage] failed:', err);
    return NextResponse.json({ error: 'Failed to load storage' }, { status: 500 });
  }
}
