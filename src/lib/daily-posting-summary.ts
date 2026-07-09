import { prisma } from '@/lib/prisma';
import { getESTDate } from '@/lib/est-date';
import { normalizeDeliverableType, normalizePlatformForMatch } from '@/lib/posting-match';

export interface DailyTargetMissingItem {
  platform: string;
  deliverableType: string;
  remaining: number;
}

export interface DailyTargetClientSummary {
  clientId: string;
  clientName: string;
  required: number;
  completed: number;
  remaining: number;
  missing: DailyTargetMissingItem[];
}

export interface DailyTargetSummary {
  grandRequired: number;
  grandCompleted: number;
  clients: DailyTargetClientSummary[]; // only clients with at least one daily target
}

// Same daily-target matching logic as the progress endpoint and the
// per-client 100%-complete cron, but returns remaining-per-client instead
// of a pass/fail — used by the team-wide SOD/midday/EOD Slack summaries.
export async function getDailyTargetSummary(): Promise<DailyTargetSummary> {
  const { start: dayStart, end: dayEnd } = getESTDate();

  const dailyTargets = await prisma.postingTarget.findMany({
    where: { frequency: 'daily' },
    include: { client: { select: { id: true, name: true, companyName: true } } },
  });

  if (dailyTargets.length === 0) {
    return { grandRequired: 0, grandCompleted: 0, clients: [] };
  }

  const clientIds = [...new Set(dailyTargets.map(t => t.clientId))];

  const todayPosts = await prisma.postedContent.findMany({
    where: { clientId: { in: clientIds }, postedAt: { gte: dayStart, lte: dayEnd } },
  });

  const byClient = new Map<string, typeof dailyTargets>();
  for (const t of dailyTargets) {
    if (!byClient.has(t.clientId)) byClient.set(t.clientId, []);
    byClient.get(t.clientId)!.push(t);
  }

  const clients: DailyTargetClientSummary[] = [];
  let grandRequired = 0;
  let grandCompleted = 0;

  for (const [clientId, targets] of byClient.entries()) {
    const client = targets[0].client;
    let required = 0;
    let completed = 0;
    const missing: DailyTargetMissingItem[] = [];

    for (const target of targets) {
      const matchingPosts = todayPosts.filter(p => {
        const pPlatform = p.platform.toLowerCase();
        const matchesPlatform = normalizePlatformForMatch(pPlatform).some(
          np => np.toLowerCase() === target.platform.toLowerCase()
        );
        const matchesType = normalizeDeliverableType(p.deliverableType) === normalizeDeliverableType(target.deliverableType);
        return matchesPlatform && matchesType && p.clientId === clientId;
      });

      const done = Math.min(matchingPosts.length, target.count);
      required += target.count;
      completed += done;
      if (done < target.count) {
        missing.push({ platform: target.platform, deliverableType: target.deliverableType, remaining: target.count - done });
      }
    }

    grandRequired += required;
    grandCompleted += completed;
    clients.push({
      clientId,
      clientName: client.companyName || client.name,
      required,
      completed,
      remaining: required - completed,
      missing,
    });
  }

  clients.sort((a, b) => b.remaining - a.remaining);

  return { grandRequired, grandCompleted, clients };
}
