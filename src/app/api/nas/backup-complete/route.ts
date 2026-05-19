export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // ── Auth: verify webhook secret ───────────────────────
    const secret = req.headers.get('x-webhook-secret');
    const expectedSecret = process.env.NAS_WEBHOOK_SECRET;

    if (!expectedSecret) {
      console.error('[NAS Webhook] NAS_WEBHOOK_SECRET not set in env');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (secret !== expectedSecret) {
      console.warn('[NAS Webhook] Invalid secret received');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────
    const body = await req.json();
    const { status, completedAt, bucketName, paths, filesCount, bytesCount, errorMessage } = body;

    if (!status || !completedAt) {
      return NextResponse.json({ error: 'Missing required fields: status, completedAt' }, { status: 400 });
    }

    console.log(`[NAS Webhook] Received backup report: status=${status} completedAt=${completedAt}`);

    // ── Save sync log ─────────────────────────────────────
    const log = await prisma.nasSyncLog.create({
      data: {
        status,
        completedAt: new Date(completedAt),
        bucketName: bucketName || null,
        paths: paths || [],
        filesCount: filesCount ? Number(filesCount) : null,
        bytesCount: bytesCount ? BigInt(bytesCount) : null,
        errorMessage: errorMessage || null,
      },
    });

    // ── If success: mark files as archivedToNas ───────────
    if (status === 'success') {
      // Mark all files that belong to completed/approved tasks as archived
      const updated = await prisma.file.updateMany({
        where: {
          archivedToNas: false,
          task: {
            status: {
              in: ['COMPLETED', 'SCHEDULED', 'POSTED', 'READY_FOR_QC'],
            },
          },
        },
        data: {
          archivedToNas: true,
          nasArchivedAt: new Date(completedAt),
          nasPath: `/volume2/Backup/outputs`,
        },
      });

      console.log(`[NAS Webhook] Marked ${updated.count} files as archivedToNas`);
    }

    return NextResponse.json({
      ok: true,
      logId: log.id,
      message: `Backup ${status} recorded`,
    });

  } catch (err: any) {
    console.error('[NAS Webhook] Error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// ── GET: last sync status (for admin panel polling) ───────────────────────────
export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get('x-webhook-secret') || req.nextUrl.searchParams.get('secret');
    if (secret !== process.env.NAS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [logs, totalFiles, archivedFiles] = await Promise.all([
      prisma.nasSyncLog.findMany({
        orderBy: { completedAt: 'desc' },
        take: 20,
      }),
      prisma.file.count(),
      prisma.file.count({ where: { archivedToNas: true } }),
    ]);

    return NextResponse.json({
      logs: logs.map(l => ({
        ...l,
        bytesCount: l.bytesCount ? Number(l.bytesCount) : null,
      })),
      stats: {
        totalFiles,
        archivedFiles,
        pendingFiles: totalFiles - archivedFiles,
        lastSync: logs[0] || null,
      },
    });
  } catch (err: any) {
    console.error('[NAS GET] Error:', err.message);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}