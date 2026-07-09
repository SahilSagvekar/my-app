export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDailyTargetSummary, DailyTargetSummary } from '@/lib/daily-posting-summary';
import { sendToChannel } from '@/lib/slack';

type Stage = 'sod' | 'midday' | 'eod';
const VALID_STAGES: Stage[] = ['sod', 'midday', 'eod'];

const STAGE_HEADER: Record<Stage, string> = {
  sod: '📋 *Daily Posting Targets — Start of Day (8:30 AM EST)*',
  midday: '📊 *Daily Posting Targets — Midday Update (12:00 PM EST)*',
  eod: '🚨 *Daily Posting Targets — End of Day (3:00 PM EST) — FIX ASAP*',
};

function buildMessage(stage: Stage, summary: DailyTargetSummary): string {
  const { grandRequired, grandCompleted, clients } = summary;
  const missingClients = clients.filter(c => c.remaining > 0);

  const lines: string[] = [STAGE_HEADER[stage]];

  if (stage === 'sod') {
    lines.push(`Total needed today: *${grandRequired}* posts across *${clients.length}* client${clients.length === 1 ? '' : 's'}`);
  } else {
    const pct = grandRequired > 0 ? Math.round((grandCompleted / grandRequired) * 100) : 100;
    lines.push(`Progress: *${grandCompleted}/${grandRequired}* done (${pct}%)`);
  }

  if (missingClients.length === 0) {
    lines.push('', stage === 'sod' ? 'No posts logged yet — nothing missing so far.' : '✅ All targets met — nothing outstanding!');
  } else {
    lines.push('', stage === 'sod' ? '*Breakdown:*' : '*Still missing:*');
    for (const c of missingClients) {
      const items = c.missing.map(m => `${m.platform} ${m.deliverableType} x${m.remaining}`).join(', ');
      lines.push(`• *${c.clientName}*: ${c.remaining} remaining (${items})`);
    }
  }

  return lines.join('\n');
}

// Runs 3x/day (registered in cron-master.ts): 8:30 AM / 12:00 PM / 3:00 PM EST.
// Posts a team-wide daily-target progress summary to the scheduling channel,
// scoped to frequency='daily' targets only (weekly/sunday targets excluded).
export async function GET(req: NextRequest) {
  try {
    const stage = new URL(req.url).searchParams.get('stage') as Stage | null;
    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ ok: false, message: 'stage must be one of sod|midday|eod' }, { status: 400 });
    }

    const summary = await getDailyTargetSummary();
    if (summary.grandRequired === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no daily targets configured' });
    }

    const message = buildMessage(stage, summary);
    const delivery = await sendToChannel('scheduling', {
      type: `daily_target_summary_${stage}`,
      message,
    });

    return NextResponse.json({
      ok: true,
      stage,
      grandRequired: summary.grandRequired,
      grandCompleted: summary.grandCompleted,
      delivery,
    });
  } catch (error: any) {
    console.error('[Daily Target Summary] Error:', error);
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 });
  }
}
