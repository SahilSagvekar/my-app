// src/app/api/cron/upload-backend-migrate/route.ts
// Scheduled job (every 5 min, see cron-master.ts) — sweeps File rows still
// sitting in the backup bucket back to primary. Also called directly (same
// x-cron-secret auth) right after the admin flips the switch back to 'r2',
// and via the "Migrate now" admin-panel button (through
// /api/admin/upload-backend/migrate-now, which calls the shared lib
// function directly rather than hitting this route over HTTP).
// See src/lib/upload-backend-migration.ts for the actual logic.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { runUploadBackendMigrationSweep } from '@/lib/upload-backend-migration';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  const cookieHeader = req.headers.get('cookie');
  const match = cookieHeader?.match(/authToken=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.role?.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runUploadBackendMigrationSweep();
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('❌ /api/cron/upload-backend-migrate error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}