export const dynamic = 'force-dynamic';
// src/app/api/drive/structure/route.ts
//
// The whole folder tree for one client (the UI navigates subfolders
// client-side against this single response).
//
// Served from the Postgres Drive index when DRIVE_INDEX_ENABLED=true — one
// indexed query, no R2 listing, no per-file presigning (see
// src/lib/drive/index-store.ts). Falls back to the file server's R2 scan
// when the flag is off, when the index has nothing for this client yet
// (backfill still running), or if the index query fails.
//
// 🔒 Previously this route had no login check and trusted `role` and
// `userId` from the query string, so anyone could fetch any client's tree
// with presigned links. Identity now comes from the session; see
// resolveDriveScope() for how `role`/`clientId` are validated.

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser2 } from '@/lib/auth';
import { getStructure } from '@/lib/file-server';
import { resolveDriveScope } from '@/lib/drive/access';
import { buildTreeFromIndex, countIndexed, isDriveIndexEnabled } from '@/lib/drive/index-store';

const EMPTY_ROOT = { name: 'Root', type: 'folder', path: '/', children: [] };

export async function GET(request: NextRequest) {
  const { env } = getCloudflareContext();
  const { searchParams } = new URL(request.url);
  const requestedRole = searchParams.get('role');
  const clientId = searchParams.get('clientId');
  let prefix = '';

  try {
    const user = await getCurrentUser2(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveDriveScope(user, requestedRole, clientId);
    prefix = scope.prefix;

    if (scope.role === 'client' && !scope.prefix) {
      return NextResponse.json({ error: 'Client not found', code: 'CLIENT_NOT_LINKED' }, { status: 404 });
    }
    // No client picked yet (admin/manager/editor with several clients) — the
    // UI shows its client selector.
    if (!scope.prefix) return NextResponse.json(EMPTY_ROOT);

    if (isDriveIndexEnabled()) {
      try {
        const started = Date.now();
        const tree = await buildTreeFromIndex(scope.prefix, user.id);
        // An empty result can mean "empty client" OR "not backfilled yet" —
        // only trust it if the index actually knows this prefix.
        if ((tree.children?.length ?? 0) > 0 || (await countIndexed(scope.prefix)) > 0) {
          return NextResponse.json(tree, {
            headers: {
              'Cache-Control': 'private, no-store',
              'x-drive-source': 'index',
              'Server-Timing': `index;dur=${Date.now() - started}`,
            },
          });
        }
      } catch (err: any) {
        console.error('[drive/structure] index read failed, falling back to file server:', err?.message);
      }
    }

    const tree = await getStructure(env, user.id, scope.role, scope.prefix);
    return NextResponse.json(tree, { headers: { 'Cache-Control': 'private, no-store', 'x-drive-source': 'file-server' } });
  } catch (error: any) {
    console.error('❌ Structure error:', { clientId, requestedRole, prefix, message: error?.message });
    return NextResponse.json({ error: 'Failed to fetch structure', details: error.message }, { status: 500 });
  }
}
