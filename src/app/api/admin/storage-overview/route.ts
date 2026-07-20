export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { getNasStorageOverview, getR2StorageOverview } from '@/lib/storage-overview';
import { formatBytes } from '@/lib/storage-service';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const [nas, r2] = await Promise.all([
      getNasStorageOverview(),
      getR2StorageOverview(),
    ]);

    return NextResponse.json({
      nas: {
        ...nas,
        usedFormatted: formatBytes(nas.used),
        totalFormatted: nas.total != null ? formatBytes(nas.total) : null,
        availableFormatted: nas.available != null ? formatBytes(nas.available) : null,
      },
      r2: {
        ...r2,
        usedFormatted: formatBytes(r2.used),
        totalFormatted: null,
        availableFormatted: null,
      },
    });
  } catch (err: any) {
    console.error('[Storage Overview]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}