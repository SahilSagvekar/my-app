export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { nasMirrorJob, user as userTable } from '@/lib/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { createNasMirrorJob, NasFolderType } from '@/lib/nas-mirror-queue';

// POST /api/nas/mirror-jobs — create a new mirror job.
// Body for outputs:      { clientName, monthFolder }
// Body for raw-footage:  { clientName, folderType: "raw-footage", folderPath }
//   folderPath is the full relative path under <clientName>/raw-footage/,
//   e.g. "June-2025" (whole month) or "June-2025/SF12" (one shoot folder).
//
// The job is inserted with status "pending" and picked up by
// nas-mirror-worker.ts on cron-master's next tick — this route returns
// immediately, it does not wait for the copy to happen.
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const clientName: string | undefined = body.clientName;
    const folderType: NasFolderType = body.folderType === 'raw-footage' ? 'raw-footage' : 'outputs';

    if (!clientName) {
      return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
    }

    let monthFolder: string;
    let folderPath: string | undefined;

    if (folderType === 'raw-footage') {
      folderPath = (body.folderPath || '').replace(/^\/+|\/+$/g, '');
      if (!folderPath) {
        return NextResponse.json({ error: 'folderPath is required for raw-footage jobs' }, { status: 400 });
      }
      monthFolder = folderPath.split('/')[0]; // first segment, for display/history
    } else {
      monthFolder = body.monthFolder;
      if (!monthFolder) {
        return NextResponse.json({ error: 'monthFolder is required for outputs jobs' }, { status: 400 });
      }
    }

    // Avoid queuing a duplicate if one's already pending/running for the same target.
    const [existing] = await db.select().from(nasMirrorJob).where(and(
      eq(nasMirrorJob.clientName, clientName),
      eq(nasMirrorJob.folderType, folderType),
      inArray(nasMirrorJob.status, ['pending', 'running']),
      folderType === 'raw-footage' ? eq(nasMirrorJob.folderPath, folderPath!) : eq(nasMirrorJob.monthFolder, monthFolder),
    )).limit(1);
    if (existing) {
      return NextResponse.json({ job: existing, alreadyQueued: true });
    }

    const job = await createNasMirrorJob({
      clientName,
      folderType,
      monthFolder,
      folderPath,
      triggeredById: user.id,
    });
    return NextResponse.json({ job, alreadyQueued: false });
  } catch (err: any) {
    console.error('[NAS Mirror Jobs POST]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// GET /api/nas/mirror-jobs — recent job history, most recent first.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const rows = await db.select({
      job: nasMirrorJob,
      TriggeredBy: { id: userTable.id, name: userTable.name },
    })
      .from(nasMirrorJob)
      .leftJoin(userTable, eq(nasMirrorJob.triggeredById, userTable.id))
      .orderBy(desc(nasMirrorJob.createdAt))
      .limit(30);

    const jobs = rows.map(r => ({ ...r.job, TriggeredBy: r.TriggeredBy.id !== null ? r.TriggeredBy : null }));

    return NextResponse.json({ jobs });
  } catch (err: any) {
    console.error('[NAS Mirror Jobs GET]', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}