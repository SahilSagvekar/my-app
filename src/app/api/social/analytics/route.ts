// src/app/api/social/analytics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

    // Verify access
    // const isAdmin = user.role === 'admin' || user.role === 'manager';
    // const isLinkedClient = user.linkedClientId === clientId;

    // console.log('[SOCIAL ANALYTICS] Request for clientId:', clientId, 'by user:', user.id, isLinkedClient, isAdmin);

    // if (!isAdmin && !isLinkedClient) {
    //   console.warn('[SOCIAL ANALYTICS] Access denied for user:', user.id);
    //   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    // }

    // Parse date range
    const days = parseInt(range.replace('d', '')) || 28;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Get connected accounts
    const accounts = await prisma.socialAccount.findMany({
      where: { clientId },
      select: {
        id: true,
        platform: true,
        platformId: true,
        platformName: true,
        profileUrl: true,
        profileImage: true,
        followerCount: true,
        isActive: true,
        lastSyncAt: true,
      },
    });

    // Get daily analytics for all accounts
    const accountIds = accounts.map(a => a.id);
    
    const dailyAnalytics = await prisma.socialAnalytics.findMany({
      where: {
        socialAccountId: { in: accountIds },
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    // Get top posts
    const topPosts = await prisma.socialPost.findMany({
      where: {
        socialAccountId: { in: accountIds },
        publishedAt: { gte: startDate },
      },
      orderBy: { views: 'desc' },
      take: 10,
      include: {
        socialAccount: {
          select: { platform: true, platformName: true },
        },
      },
    });

    // Calculate overview stats
    const latestByAccount = new Map<string, typeof dailyAnalytics[0]>();
    const previousByAccount = new Map<string, typeof dailyAnalytics[0]>();

    dailyAnalytics.forEach(record => {
      const existing = latestByAccount.get(record.socialAccountId);
      if (!existing || record.date > existing.date) {
        if (existing) {
          previousByAccount.set(record.socialAccountId, existing);
        }
        latestByAccount.set(record.socialAccountId, record);
      }
    });

    // Aggregate current stats
    let totalFollowers = 0;
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    // Aggregate previous stats for comparison
    let prevFollowers = 0;
    let prevViews = 0;
    let prevLikes = 0;
    let prevComments = 0;

    latestByAccount.forEach((record, accountId) => {
      totalFollowers += record.followers;
      totalViews += record.views;
      totalLikes += record.likes;
      totalComments += record.comments;
      totalShares += record.shares;

      const prev = previousByAccount.get(accountId);
      if (prev) {
        prevFollowers += prev.followers;
        prevViews += prev.views;
        prevLikes += prev.likes;
        prevComments += prev.comments;
      }
    });

    // Calculate percentage changes
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    // Format chart data
    const chartData = formatChartData(dailyAnalytics, days);

    // Calculate average engagement rate
    const totalEngagement = totalLikes + totalComments + totalShares;
    const avgEngagement = totalFollowers > 0 
      ? (totalEngagement / totalFollowers) * 100 
      : 0;

    return NextResponse.json({
      ok: true,
      accounts,
      overview: {
        totalFollowers,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        avgEngagement,
        followersChange: calcChange(totalFollowers, prevFollowers),
        viewsChange: calcChange(totalViews, prevViews),
        likesChange: calcChange(totalLikes, prevLikes),
        commentsChange: calcChange(totalComments, prevComments),
        engagementChange: 0, // Would need historical engagement data
      },
      chartData,
      topPosts: topPosts.map(post => ({
        id: post.id,
        platform: post.socialAccount.platform,
        platformName: post.socialAccount.platformName,
        title: post.title,
        description: post.description,
        thumbnailUrl: post.thumbnailUrl,
        postUrl: post.postUrl,
        publishedAt: post.publishedAt.toISOString(),
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        engagementRate: post.engagementRate,
      })),
    });
  } catch (error: any) {
    console.error('[SOCIAL ANALYTICS] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

function formatChartData(
  analytics: Array<{
    date: Date;
    followers: number;
    followersGained: number;
    followersLost: number;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }>,
  days: number
) {
  // Group by date
  const byDate = new Map<string, {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    gained: number;
    lost: number;
  }>();

  analytics.forEach(record => {
    const dateStr = record.date.toISOString().split('T')[0];
    const existing = byDate.get(dateStr) || {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      gained: 0,
      lost: 0,
    };

    byDate.set(dateStr, {
      views: existing.views + record.views,
      likes: existing.likes + record.likes,
      comments: existing.comments + record.comments,
      shares: existing.shares + record.shares,
      gained: existing.gained + record.followersGained,
      lost: existing.lost + record.followersLost,
    });
  });

  // Fill missing dates
  const daily: Array<{
    date: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
  }> = [];

  const followers: Array<{
    date: string;
    gained: number;
    lost: number;
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const data = byDate.get(dateStr) || {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      gained: 0,
      lost: 0,
    };

    daily.push({
      date: displayDate,
      views: data.views,
      likes: data.likes,
      comments: data.comments,
      shares: data.shares,
    });

    followers.push({
      date: displayDate,
      gained: data.gained,
      lost: data.lost,
    });
  }

  return { daily, followers };
}