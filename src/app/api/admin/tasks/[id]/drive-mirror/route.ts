// POST /api/admin/tasks/[id]/drive-mirror
// Admin-only: manually re-trigger the Google Drive mirror for every active
// video file on a task. Useful when the automatic mirror failed or the
// Drive token was rotated.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { generateFileServerToken } from '@/lib/file-server';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

function verifyAdminAccess(token: string): { userId: number; role: string } | null {
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!['admin', 'manager'].includes(decoded.role?.toLowerCase())) return null;
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

function isLikelyGoogleDriveFolderId(value?: string | null): value is string {
  if (!value) return false;
  return /^[a-zA-Z0-9_-]{25,}$/.test(value);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const cookieToken = getTokenFromCookies(req);
    if (!cookieToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = verifyAdminAccess(cookieToken);
    if (!auth) {
      return NextResponse.json({ error: 'Forbidden — admin or manager only' }, { status: 403 });
    }

    const { id: taskId } = await params;

    // Fetch task with its active video files and client info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        driveFolderId: true,
        client: { select: { companyName: true, name: true } },
        files: {
          where: {
            isActive: true,
            mimeType: { startsWith: 'video/' },
          },
          select: {
            id: true,
            name: true,
            s3Key: true,
            mimeType: true,
            reviewDriveUrl: true,
            folderType: true,
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.files.length === 0) {
      return NextResponse.json(
        { error: 'No active video files found on this task' },
        { status: 400 },
      );
    }

    const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'http://localhost:4000';
    const APP_URL =
      process.env.INTERNAL_APP_URL ||
      process.env.NEXTAUTH_URL ||
      process.env.BASE_URL ||
      'https://e8productions.com';

    const fileServerToken = generateFileServerToken(auth.userId, auth.role);
    const driveFolderId = isLikelyGoogleDriveFolderId(task.driveFolderId)
      ? task.driveFolderId
      : null;
    const clientName =
      task.client?.companyName || task.client?.name || 'Unknown Client';

    const results: { fileId: string; name: string; status: 'dispatched' | 'skipped' | 'error'; reason?: string }[] = [];

    for (const file of task.files) {
      if (!file.s3Key) {
        results.push({ fileId: file.id, name: file.name, status: 'skipped', reason: 'No S3 key' });
        continue;
      }

      // Build a callback token so the file server can write back to our DB
      const callbackToken = jwt.sign(
        { purpose: 'drive-mirror-complete', fileRecordId: file.id },
        process.env.FILE_SERVER_SECRET || '',
        { expiresIn: '24h' },
      );
      const callbackUrl = new URL('/api/internal/drive-mirror-complete', APP_URL);
      callbackUrl.searchParams.set('token', callbackToken);

      try {
        const res = await fetch(`${FILE_SERVER_URL}/drive-mirror`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${fileServerToken}`,
          },
          body: JSON.stringify({
            key: file.s3Key,
            fileName: file.name,
            mimeType: file.mimeType || 'video/mp4',
            folderId: driveFolderId || undefined,
            clientName: driveFolderId ? undefined : clientName,
            fileRecordId: file.id,
            callbackUrl: callbackUrl.toString(),
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          results.push({ fileId: file.id, name: file.name, status: 'error', reason: errText });
        } else {
          results.push({ fileId: file.id, name: file.name, status: 'dispatched' });
        }
      } catch (err: any) {
        results.push({ fileId: file.id, name: file.name, status: 'error', reason: err.message });
      }
    }

    const dispatched = results.filter(r => r.status === 'dispatched').length;
    const errors = results.filter(r => r.status === 'error').length;

    console.log(
      `[Admin Drive Mirror] Task ${taskId} — ${dispatched} dispatched, ${errors} errors, ${results.length - dispatched - errors} skipped`,
    );

    return NextResponse.json({
      ok: true,
      dispatched,
      total: task.files.length,
      results,
    });
  } catch (err: any) {
    console.error('[Admin Drive Mirror] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}