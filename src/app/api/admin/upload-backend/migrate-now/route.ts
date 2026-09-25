export const dynamic = 'force-dynamic';
// src/app/api/admin/upload-backend/migrate-now/route.ts
//
// Manual "Migrate now" button in UploadBackupAdmin.tsx. Same job the
// scheduled cron runs (see /api/cron/upload-backend-migrate) — this just
// lets the admin re-trigger it on demand instead of waiting for the next
// 5-minute sweep, e.g. right after flipping the switch back to primary.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { runUploadBackendMigrationSweep } from '@/lib/upload-backend-migration';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const result = await runUploadBackendMigrationSweep();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[upload-backend migrate-now]', err.message);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}