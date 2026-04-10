export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getClientStorageInfo, recalculateClientStorage } from '@/lib/storage-service';

/**
 * GET /api/clients/[id]/storage
 * Get storage info for a client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh') === 'true';

    let storageInfo;
    
    if (refresh) {
      // Recalculate from S3 (slower but accurate)
      storageInfo = await recalculateClientStorage(id);
    } else {
      // Get cached value from database (fast)
      storageInfo = await getClientStorageInfo(id);
    }

    return NextResponse.json(storageInfo);
  } catch (error: any) {
    console.error('Error fetching storage info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch storage info', details: error.message },
      { status: 500 }
    );
  }
}