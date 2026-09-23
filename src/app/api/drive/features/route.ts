export const dynamic = 'force-dynamic';
// src/app/api/drive/features/route.ts
// Which Drive features are switched on, so the UI only shows Recent /
// Starred / Trash / previews once the index behind them is live.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { isDriveIndexEnabled, isDrivePreviewsEnabled, isDriveTrashEnabled, TRASH_RETENTION_DAYS } from '@/lib/drive/index-store';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    index: isDriveIndexEnabled(),
    trash: isDriveTrashEnabled(),
    previews: isDrivePreviewsEnabled(),
    trashRetentionDays: TRASH_RETENTION_DAYS,
  }, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
