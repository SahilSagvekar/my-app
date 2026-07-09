export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { getESTDate, getESTDayOfWeek, getESTWeekBounds } from '@/lib/est-date';
import {
  normalizeDeliverableType,
  normalizePlatformForMatch,
  targetPlatformToPostedPlatform,
} from '@/lib/posting-match';

export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date') || undefined;
    const clientIdFilter = searchParams.get('clientId') || undefined;

    const { start: dayStart, end: dayEnd } = getESTDate(dateParam);
    const { start: weekStart, end: weekEnd } = getESTWeekBounds(dateParam);
    const dayOfWeek = getESTDayOfWeek(dateParam);
    const isSunday = dayOfWeek === 0;

    // Fetch all posting targets
    const targetWhere: any = {};
    if (clientIdFilter) targetWhere.clientId = clientIdFilter;

    const allTargets = await prisma.postingTarget.findMany({
      where: targetWhere,
      include: {
        client: { select: { id: true, name: true, companyName: true } },
      },
    });

    if (allTargets.length === 0) {
      return NextResponse.json({
        ok: true,
        date: dayStart.toISOString(),
        dayOfWeek,
        isSunday,
        clients: [],
      });
    }

    // Get unique client IDs from targets
    const clientIds = [...new Set(allTargets.map(t => t.clientId))];

    // Fetch today's posted content for these clients
    const todayPosts = await prisma.postedContent.findMany({
      where: {
        clientId: { in: clientIds },
        postedAt: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { postedAt: 'desc' },
    });

    // Fetch this week's posted content (for weekly targets)
    const weekPosts = await prisma.postedContent.findMany({
      where: {
        clientId: { in: clientIds },
        postedAt: { gte: weekStart, lte: weekEnd },
      },
      orderBy: { postedAt: 'desc' },
    });

    // Group targets by client
    const clientTargetMap = new Map<string, typeof allTargets>();
    for (const t of allTargets) {
      if (!clientTargetMap.has(t.clientId)) clientTargetMap.set(t.clientId, []);
      clientTargetMap.get(t.clientId)!.push(t);
    }

    // Build response per client
    const clients = Array.from(clientTargetMap.entries()).map(([clientId, targets]) => {
      const client = targets[0].client;

      // Group targets by platform
      const platformMap = new Map<string, any[]>();
      for (const t of targets) {
        if (!platformMap.has(t.platform)) platformMap.set(t.platform, []);
        platformMap.get(t.platform)!.push(t);
      }

      let clientDailyTarget = 0;
      let clientDailyCompleted = 0;

      const platforms = Array.from(platformMap.entries()).map(([platformName, platformTargets]) => {
        const postedPlatform = targetPlatformToPostedPlatform(platformName);

        const deliverables = platformTargets.map(target => {
          const isWeekly = target.frequency === 'weekly';
          const isSundayOnly = target.frequency === 'sunday';

          // For daily: count today's posts matching this platform + deliverableType
          // For weekly: count this week's posts
          // For sunday: only count if today is Sunday, use today's posts
          const postsToSearch = isWeekly ? weekPosts : todayPosts;
          const isActive = isSundayOnly ? isSunday : true;

          const matchingPosts = postsToSearch.filter(p => {
            const pPlatform = p.platform.toLowerCase();
            const matchesPlatform = pPlatform === postedPlatform ||
              normalizePlatformForMatch(pPlatform).some(
                np => np.toLowerCase() === platformName.toLowerCase()
              );
            const normalizedPostType = normalizeDeliverableType(p.deliverableType);
            const normalizedTargetType = normalizeDeliverableType(target.deliverableType);
            const matchesType = normalizedPostType === normalizedTargetType;
            return matchesPlatform && matchesType && p.clientId === clientId;
          });

          const completed = matchingPosts.length;
          const required = isActive ? target.count : 0;

          if (isActive) {
            clientDailyTarget += required;
            clientDailyCompleted += Math.min(completed, required);
          }

          return {
            deliverableType: target.deliverableType,
            required: target.count,
            frequency: target.frequency,
            isActive,
            completed,
            remaining: Math.max(0, required - completed),
            extras: target.extras,
            links: matchingPosts.map(p => ({
              id: p.id,
              url: p.url,
              title: p.title,
              postedAt: p.postedAt,
              taskId: p.taskId,
            })),
          };
        });

        const platformTotal = deliverables.reduce((sum, d) => sum + (d.isActive ? d.required : 0), 0);
        const platformCompleted = deliverables.reduce((sum, d) => sum + Math.min(d.completed, d.isActive ? d.required : 0), 0);

        return {
          platform: platformName,
          deliverables,
          totalRequired: platformTotal,
          totalCompleted: platformCompleted,
          progress: platformTotal > 0 ? Math.round((platformCompleted / platformTotal) * 100) : 100,
        };
      });

      return {
        clientId,
        clientName: client.companyName || client.name,
        platforms,
        totalRequired: clientDailyTarget,
        totalCompleted: clientDailyCompleted,
        progress: clientDailyTarget > 0 ? Math.round((clientDailyCompleted / clientDailyTarget) * 100) : 100,
      };
    });

    // Sort: incomplete first, then by total required desc
    clients.sort((a, b) => {
      if (a.progress === 100 && b.progress !== 100) return 1;
      if (a.progress !== 100 && b.progress === 100) return -1;
      return b.totalRequired - a.totalRequired;
    });

    const grandTotal = clients.reduce((s, c) => s + c.totalRequired, 0);
    const grandCompleted = clients.reduce((s, c) => s + c.totalCompleted, 0);

    return NextResponse.json({
      ok: true,
      date: dayStart.toISOString(),
      dayOfWeek,
      isSunday,
      grandTotal,
      grandCompleted,
      grandProgress: grandTotal > 0 ? Math.round((grandCompleted / grandTotal) * 100) : 100,
      clients,
    });
  } catch (error) {
    console.error('Error fetching daily target progress:', error);
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 });
  }
}