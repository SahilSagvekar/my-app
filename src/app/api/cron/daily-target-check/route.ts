export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getESTDate, getESTDateString } from '@/lib/est-date';
import { normalizeDeliverableType, normalizePlatformForMatch } from '@/lib/posting-match';
import { sendToChannel } from '@/lib/slack';

// Runs every 2 hours (registered in cron-master.ts).
// Checks every client with at least one daily PostingTarget: if every daily
// target is fully met for today (EST), send a Slack "all done" notice to the
// client's own channel (falls back to the shared scheduling channel if the
// client has no Slack channel configured). Sends at most once per client per
// EST calendar day via the DailyTargetNotification dedup row.
export async function GET() {
  try {
    const today = getESTDateString();
    const { start: dayStart, end: dayEnd } = getESTDate();

    const dailyTargets = await prisma.postingTarget.findMany({
      where: {
        frequency: 'daily',
        NOT: { platform: { equals: 'snapchat', mode: 'insensitive' } },
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
            slackEnabled: true,
            slackWebhookUrl: true,
            slackChannelName: true,
          },
        },
      },
    });

    if (dailyTargets.length === 0) {
      return NextResponse.json({ ok: true, checked: 0, notified: 0 });
    }

    const clientIds = [...new Set(dailyTargets.map(t => t.clientId))];

    const todayPosts = await prisma.postedContent.findMany({
      where: { clientId: { in: clientIds }, postedAt: { gte: dayStart, lte: dayEnd } },
      orderBy: { postedAt: 'desc' },
    });

    const alreadyNotified = await prisma.dailyTargetNotification.findMany({
      where: { clientId: { in: clientIds }, date: today },
      select: { clientId: true },
    });
    const alreadyNotifiedSet = new Set(alreadyNotified.map(n => n.clientId));

    const targetsByClient = new Map<string, typeof dailyTargets>();
    for (const t of dailyTargets) {
      if (!targetsByClient.has(t.clientId)) targetsByClient.set(t.clientId, []);
      targetsByClient.get(t.clientId)!.push(t);
    }

    let notified = 0;

    for (const [clientId, targets] of targetsByClient.entries()) {
      if (alreadyNotifiedSet.has(clientId)) continue;

      const client = targets[0].client;
      let allMet = true;
      const links: { platform: string; deliverableType: string; url: string; title: string | null }[] = [];

      for (const target of targets) {
        const matchingPosts = todayPosts.filter(p => {
          const pPlatform = p.platform.toLowerCase();
          const matchesPlatform = normalizePlatformForMatch(pPlatform).some(
            np => np.toLowerCase() === target.platform.toLowerCase()
          );
          const matchesType = normalizeDeliverableType(p.deliverableType) === normalizeDeliverableType(target.deliverableType);
          return matchesPlatform && matchesType && p.clientId === clientId;
        });

        if (matchingPosts.length < target.count) {
          allMet = false;
          break;
        }

        for (const p of matchingPosts) {
          links.push({ platform: target.platform, deliverableType: target.deliverableType, url: p.url, title: p.title });
        }
      }

      if (!allMet) continue;

      const clientName = client.companyName || client.name;
      const linkLines = links
        .map(l => `• *${l.platform}* (${l.deliverableType}): <${l.url}|${l.title || 'View post'}>`)
        .join('\n');

      const notification = {
        type: 'daily_targets_complete',
        message: `🎉 *${clientName}* — all daily posting targets are met for today!\n${linkLines}`,
        payload: { clientId },
      };

      let sent = false;
      if (client.slackEnabled && client.slackWebhookUrl) {
        try {
          const res = await fetch(client.slackWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: notification.message }),
          });
          sent = res.ok;
        } catch (err) {
          console.error(`[Daily Target Check] Client webhook threw for ${clientName}:`, err);
        }
        if (!sent) {
          console.error(`[Daily Target Check] Client webhook failed for ${clientName}, falling back to scheduling channel`);
        }
      }

      if (!sent) {
        await sendToChannel('scheduling', notification);
      }

      await prisma.dailyTargetNotification.create({
        data: { clientId, date: today },
      });
      notified++;
    }

    return NextResponse.json({ ok: true, checked: targetsByClient.size, notified });
  } catch (error: any) {
    console.error('[Daily Target Check] Error:', error);
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 });
  }
}
