export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import {
  applyLinkedinJobUpdate,
  LinkedinJobPayload,
} from '@/lib/linkedin-lead-jobs';

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.LINKEDIN_LEAD_CALLBACK_SECRET;
    const incomingSecret = req.headers.get('x-linkedin-callback-secret');

    if (expectedSecret && incomingSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = (await req.json()) as LinkedinJobPayload;
    if (!payload.job_id) {
      return NextResponse.json({ ok: false, message: 'Missing job_id' }, { status: 400 });
    }

    const result = await applyLinkedinJobUpdate(payload, 'callback');
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: 'Job not found' }, { status: 404 });
    }

    if (payload.status === 'FAILED' || payload.status === 'PLATFORM_DRIFT' || payload.status === 'ANTI_BOT') {
      console.error(
        `[LinkedIn Lead Sync] External job ${payload.job_id} ended with status ${payload.status}: ${payload.error || 'unknown error'}`,
      );
    } else {
      console.log(
        `[LinkedIn Lead Sync] Applied external job ${payload.job_id} with status ${payload.status}. Imported ${result.importedLeads} leads, duplicates skipped: ${result.duplicateLeads}`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[POST /api/integrations/linkedin-leads/callback]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
