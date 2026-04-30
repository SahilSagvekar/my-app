export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';

// Normalize deliverableType from PostedContent to short code
// PostedContent might store "Short Form Videos" or "SF" — we need consistent matching
function normalizeDeliverableType(type: string | null | undefined): string {
  if (!type) return '';
  const t = type.toLowerCase().trim();
  if (t === 'short form videos' || t === 'sf') return 'SF';
  if (t === 'long form videos' || t === 'lf') return 'LF';
  if (t === 'square form videos' || t === 'sqf') return 'SQF';
  if (t === 'thumbnails' || t === 'thumb') return 'THUMB';
  if (t === 'tiles' || t === 't') return 'T';
  if (t === 'hard posts / graphic images' || t === 'hard posts' || t === 'hp') return 'HP';
  if (t === 'snapchat episodes' || t === 'sep') return 'SEP';
  if (t === 'beta short form' || t === 'bsf') return 'BSF';
  return type.toUpperCase().replace(/\s+/g, '');
}

// Map PostedContent platform (lowercase) to all PostingTarget platform names it could match
function normalizePlatformForMatch(postedPlatform: string): string[] {
  const p = postedPlatform.toLowerCase().trim();
  const map: Record<string, string[]> = {
    'instagram': ['IG', 'IG (Trials)', 'Instagram', 'ig', 'ig (trials)', 'instagram'],
    'facebook': ['FB Profile', 'FB Page', 'FB TV', 'Facebook', 'fb profile', 'fb page', 'fb tv', 'facebook'],
    'tiktok': ['TT', 'TikTok', 'tt', 'tiktok'],
    'youtube': ['YT', 'YouTube', 'yt', 'youtube'],
    'linkedin': ['LI', 'LinkedIn', 'li', 'linkedin'],
    'twitter': ['Twitter', 'X', 'twitter', 'x'],
    'snapchat': ['Snapchat', 'snapchat'],
  };
  return map[p] || [postedPlatform];
}

// Map PostingTarget platform to PostedContent platform (reverse)
function targetPlatformToPostedPlatform(targetPlatform: string): string {
  const p = targetPlatform.toLowerCase();
  if (p.includes('ig') || p.includes('instagram')) return 'instagram';
  if (p.includes('fb') || p.includes('facebook')) return 'facebook';
  if (p === 'tt' || p.includes('tiktok')) return 'tiktok';
  if (p === 'yt' || p.includes('youtube')) return 'youtube';
  if (p === 'li' || p.includes('linkedin')) return 'linkedin';
  if (p.includes('twitter') || p === 'x') return 'twitter';
  if (p.includes('snapchat')) return 'snapchat';
  return p;
}

const EST_TZ = 'America/New_York';

/**
 * Extract the calendar date parts (year, month, day, weekday) as seen in EST.
 * Uses Intl.DateTimeFormat — reliable across all Node/V8 versions.
 */
function getESTParts(now: Date): { year: number; month: number; day: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = fmt.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10) - 1, // 0-indexed
    day: parseInt(get('day'), 10),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/**
 * Build a UTC Date that represents midnight (or end-of-day) of the given
 * EST calendar date. We do this by constructing an ISO string with the
 * America/New_York offset for that instant.
 */
function estCalendarToUTC(year: number, month0: number, day: number, endOfDay = false): Date {
  // Create a Date at noon EST on that day so DST can't shift us to the wrong calendar date
  const noon = new Date(`${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00`);
  // Find the UTC offset for that timezone on that day
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TZ,
    hour: 'numeric',
    hour12: false,
    timeZoneName: 'shortOffset',
  });
  const parts = fmt.formatToParts(noon);
  const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT-5'; // e.g. "GMT-4" or "GMT-5"
  const match = offsetStr.match(/GMT([+-]\d+)/);
  const offsetHours = match ? parseInt(match[1], 10) : -5;

  if (endOfDay) {
    // 23:59:59.999 EST = next day 00:00:00 UTC minus 1ms, adjusted for offset
    return new Date(Date.UTC(year, month0, day, 23 - offsetHours, 59, 59, 999));
  } else {
    // 00:00:00.000 EST
    return new Date(Date.UTC(year, month0, day, 0 - offsetHours, 0, 0, 0));
  }
}

function getESTDate(date?: string): { start: Date; end: Date } {
  const now = date ? new Date(date) : new Date();
  const { year, month, day } = getESTParts(now);
  return {
    start: estCalendarToUTC(year, month, day, false),
    end: estCalendarToUTC(year, month, day, true),
  };
}

function getESTDayOfWeek(date?: string): number {
  const now = date ? new Date(date) : new Date();
  return getESTParts(now).weekday;
}

function getESTWeekBounds(date?: string): { start: Date; end: Date } {
  const now = date ? new Date(date) : new Date();
  const { year, month, day, weekday } = getESTParts(now);

  // Build a plain JS Date at midnight local (doesn't matter — we only use it for arithmetic)
  const estDay = new Date(year, month, day);

  // Monday of this week
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(estDay);
  monday.setDate(estDay.getDate() + mondayOffset);

  // Sunday of this week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: estCalendarToUTC(monday.getFullYear(), monday.getMonth(), monday.getDate(), false),
    end: estCalendarToUTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), true),
  };
}

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