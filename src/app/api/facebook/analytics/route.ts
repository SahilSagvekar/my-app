// src/app/api/facebook/analytics/route.ts
// GET - Fetch Facebook Page analytics

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { FacebookService } from '@/lib/social/facebook';
import { decrypt } from '@/lib/encryption';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const range = searchParams.get('range') || '28d';

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Get Facebook pages for this client
    const pages = await prisma.facebookPage.findMany({
      where: { clientId, isActive: true },
    });

    if (pages.length === 0) {
      return NextResponse.json({
        ok: true,
        connected: false,
        message: 'No Facebook pages connected',
        pages: [],
        overview: null,
      });
    }

    const days = parseInt(range.replace('d', '')) || 28;
    const allPagesData: any[] = [];

    for (const page of pages) {
      try {
        const accessToken = decrypt(page.pageAccessToken);
        const fbService = new FacebookService(accessToken, page.pageId, accessToken);

        // Fetch all data in parallel
        const [stats, posts, dailyInsights, demographics] = await Promise.all([
          fbService.getAccountStats(),
          fbService.getRecentPosts(20),
          fbService.getDailyInsights(days),
          fbService.getAudienceDemographics(),
        ]);

        allPagesData.push({
          page: {
            id: page.id,
            pageId: page.pageId,
            name: page.pageName,
            category: page.category,
            picture: page.profilePicture,
          },
          stats,
          posts: posts.slice(0, 10), // Top 10 posts
          dailyInsights,
          demographics,
        });
      } catch (err: any) {
        console.error(`[FACEBOOK] Error fetching data for page ${page.pageId}:`, err);
        allPagesData.push({
          page: {
            id: page.id,
            pageId: page.pageId,
            name: page.pageName,
            category: page.category,
            picture: page.profilePicture,
          },
          error: err.message,
        });
      }
    }

    // Calculate combined overview
    const overview = {
      totalFollowers: 0,
      totalLikes: 0,
      totalImpressions: 0,
      totalReach: 0,
      totalEngagement: 0,
      avgEngagementRate: 0,
    };

    let validPages = 0;
    allPagesData.forEach(data => {
      if (data.stats) {
        overview.totalFollowers += data.stats.followers || 0;
        overview.totalLikes += data.stats.likes || 0;
        overview.totalImpressions += data.stats.impressions || 0;
        overview.totalReach += data.stats.reach || 0;
        overview.avgEngagementRate += data.stats.engagementRate || 0;
        validPages++;
      }
    });

    if (validPages > 0) {
      overview.avgEngagementRate = Math.round((overview.avgEngagementRate / validPages) * 100) / 100;
    }

    // Combine daily insights from all pages
    const combinedDaily = new Map<string, any>();
    allPagesData.forEach(data => {
      data.dailyInsights?.forEach((day: any) => {
        if (!combinedDaily.has(day.date)) {
          combinedDaily.set(day.date, {
            date: day.date,
            impressions: 0,
            reach: 0,
            engagement: 0,
          });
        }
        const entry = combinedDaily.get(day.date)!;
        entry.impressions += day.impressions || 0;
        entry.reach += day.reach || 0;
        entry.engagement += day.engagement || 0;
      });
    });

    // Get top posts across all pages
    const allPosts = allPagesData
      .flatMap(data => data.posts || [])
      .sort((a, b) => (b.reach || 0) - (a.reach || 0))
      .slice(0, 10);

    return NextResponse.json({
      ok: true,
      connected: true,
      pages: allPagesData,
      overview,
      chartData: {
        daily: Array.from(combinedDaily.values()).sort((a, b) => a.date.localeCompare(b.date)),
      },
      topPosts: allPosts,
    });
  } catch (error: any) {
    console.error('[FACEBOOK ANALYTICS] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}