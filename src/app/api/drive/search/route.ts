export const dynamic = 'force-dynamic';
// src/app/api/drive/search/route.ts
//
// Search-as-you-type across Drive. With the Drive index on, this is one
// trigram-indexed Postgres query (file name first, then path) instead of
// listing every object under the prefix on each keystroke.
//
// 🔒 Previously no login check, and `role`/`userId` came from the query
// string — `?role=admin&q=mp4` searched the entire bucket for anyone.
// Scope now comes from the session (see resolveDriveScope). Pass
// `clientId` to search only the client that's open.

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser2 } from '@/lib/auth';
import { searchFiles } from '@/lib/file-server';
import { resolveDriveScope } from '@/lib/drive/access';
import { isDriveIndexEnabled, searchIndex } from '@/lib/drive/index-store';

export async function GET(request: NextRequest) {
  const { env } = getCloudflareContext();
  try {
    const user = await getCurrentUser2(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const max = Math.min(parseInt(searchParams.get('max') || '50', 10) || 50, 100);
    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 });
    }

    const scope = await resolveDriveScope(user, searchParams.get('role'), searchParams.get('clientId'));

    if (isDriveIndexEnabled()) {
      try {
        const results = await searchIndex({
          query,
          allowedPrefixes: scope.allowedPrefixes,
          prefix: scope.prefix || undefined,
          userId: user.id,
          max,
        });
        return NextResponse.json({ query, results, source: 'index' });
      } catch (err: any) {
        console.error('[drive/search] index search failed, falling back to file server:', err?.message);
      }
    }

    // Legacy R2 scan: never let a scoped user fall through to a whole-bucket search.
    let prefix = scope.prefix;
    if (!prefix && scope.allowedPrefixes !== null) {
      if (scope.allowedPrefixes.length !== 1) return NextResponse.json({ query, results: [], totalScanned: 0 });
      prefix = scope.allowedPrefixes[0];
    }
    const result = await searchFiles(env, user.id, scope.role, query.toLowerCase(), prefix, max);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed', details: error.message }, { status: 500 });
  }
}
