// src/app/api/cron/client-review-reminders/route.ts
// Daily job: reminds clients about tasks that have been sitting in
// CLIENT_REVIEW past the threshold, skipping anything reminded within the
// cooldown window. See src/lib/client-review-reminders.ts for the query
// and email logic — this route is just the cron-triggered entry point.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getTasksNeedingAutoReminder, sendReviewReminder } from '@/lib/client-review-reminders';

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && process.env.CRON_SECRET) {
    if (authHeader.slice(7) === process.env.CRON_SECRET) return true;
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
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const byClient = await getTasksNeedingAutoReminder();

    let clientsReminded = 0;
    let clientsFailed = 0;
    const details: Array<{ clientId: string; clientName: string; taskCount: number; success: boolean }> = [];

    for (const [clientId, tasks] of byClient) {
      const result = await sendReviewReminder(tasks);
      details.push({ clientId, clientName: tasks[0].clientName, taskCount: tasks.length, success: result.success });
      if (result.success) clientsReminded++;
      else clientsFailed++;
    }

    console.log(`[cron/client-review-reminders] ${clientsReminded} client(s) reminded, ${clientsFailed} failed`);
    return NextResponse.json({ ok: true, clientsReminded, clientsFailed, details });
  } catch (err: any) {
    console.error('[cron/client-review-reminders]', err);
    if (err?.cause) console.error('Root cause:', err.cause);
    return NextResponse.json({ ok: false, message: err?.cause?.message || 'Server error' }, { status: 500 });
  }
}