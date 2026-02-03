// lib/youtube-sync-service.ts
import { prisma } from './prisma';
import { google } from 'googleapis';

const youtube = google.youtube('v3');
const youtubeAnalytics = google.youtubeAnalytics('v2');

interface YouTubeMetrics {
    views: number;
    watchTimeHours: number;
    estimatedRevenue: number;
    subscriberCount: number;
    subscribersGained: number;
    subscribersLost: number;
    likes: number;
    comments: number;
    shares: number;
    impressions: number;
    impressionsCtr: number;
    avgViewDuration: number;
    geographyData?: any[];
    deviceData?: any[];
}

interface SyncResult {
    success: boolean;
    clientId: string;
    channelId?: string;
    error?: string;
}

/**
 * Refresh YouTube access token using refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expires_in: number;
}> {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_YOUTUBE_CLIENT_ID,
        process.env.GOOGLE_YOUTUBE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`
    );

    oauth2Client.setCredentials({
        refresh_token: refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    return {
        access_token: credentials.access_token!,
        expires_in: credentials.expiry_date
            ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
            : 3600,
    };
}

/**
 * Get valid access token (refresh if expired)
 */
async function getValidAccessToken(youtubeChannel: any): Promise<string> {
    const now = new Date();

    // Check if token is expired or will expire in next 5 minutes
    if (youtubeChannel.tokenExpiry && new Date(youtubeChannel.tokenExpiry) <= new Date(now.getTime() + 5 * 60 * 1000)) {
        console.log(`[YouTube Sync] Token expired for channel ${youtubeChannel.channelId}, refreshing...`);

        const newTokens = await refreshAccessToken(youtubeChannel.refreshToken);

        // Update token in database
        await prisma.youTubeChannel.update({
            where: { id: youtubeChannel.id },
            data: {
                accessToken: newTokens.access_token,
                tokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000),
            },
        });

        return newTokens.access_token;
    }

    return youtubeChannel.accessToken;
}

/**
 * Fetch channel statistics (subscriber count)
 */
async function fetchChannelStats(channelId: string, accessToken: string): Promise<{
    subscriberCount: number;
    totalViews: number;
    totalVideos: number;
}> {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    const response = await youtube.channels.list({
        auth: oauth2Client,
        part: ['statistics'],
        id: [channelId],
    });

    const channel = response.data.items?.[0];
    if (!channel?.statistics) {
        throw new Error('Channel statistics not found');
    }

    return {
        subscriberCount: parseInt(channel.statistics.subscriberCount || '0'),
        totalViews: parseInt(channel.statistics.viewCount || '0'),
        totalVideos: parseInt(channel.statistics.videoCount || '0'),
    };
}

/**
 * Fetch YouTube Analytics data for a specific period
 */
async function fetchYouTubeAnalytics(
    channelId: string,
    accessToken: string,
    startDate: string,
    endDate: string
): Promise<YouTubeMetrics> {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });

    try {
        // Fetch standard analytics data (available for all channels)
        const response = await youtubeAnalytics.reports.query({
            auth: oauth2Client,
            ids: `channel==${channelId}`,
            startDate,
            endDate,
            metrics: [
                'views',
                'estimatedMinutesWatched',
                'likes',
                'comments',
                'shares',
                'subscribersGained',
                'subscribersLost',
                'averageViewDuration',
            ].join(','),
        });

        const row = response.data.rows?.[0] || [0, 0, 0, 0, 0, 0, 0, 0];

        // Fetch geography data
        let geographyData: any[] = [];
        try {
            const geoRes = await youtubeAnalytics.reports.query({
                auth: oauth2Client,
                ids: `channel==${channelId}`,
                startDate,
                endDate,
                metrics: 'views',
                dimensions: 'country',
                sort: '-views',
                maxResults: 10
            });
            geographyData = geoRes.data.rows?.map(r => ({ country: r[0], views: r[1] })) || [];
        } catch (e) {
            console.log('[YouTube Sync] Geography data failed:', e);
        }

        // Fetch device data
        let deviceData: any[] = [];
        try {
            const deviceRes = await youtubeAnalytics.reports.query({
                auth: oauth2Client,
                ids: `channel==${channelId}`,
                startDate,
                endDate,
                metrics: 'views',
                dimensions: 'deviceType',
                sort: '-views'
            });
            deviceData = deviceRes.data.rows?.map(r => ({ device: r[0], views: r[1] })) || [];
        } catch (e) {
            console.log('[YouTube Sync] Device data failed:', e);
        }

        // Parse standard metrics
        const [
            views,
            estimatedMinutesWatched,
            likes,
            comments,
            shares,
            subscribersGained,
            subscribersLost,
            averageViewDuration,
        ] = row as number[];

        // Try to fetch revenue separately as it often causes "Forbidden" on non-monetized channels
        let estimatedRevenue = 0;
        try {
            const revenueRes = await youtubeAnalytics.reports.query({
                auth: oauth2Client,
                ids: `channel==${channelId}`,
                startDate,
                endDate,
                metrics: 'estimatedRevenue',
            });
            estimatedRevenue = (revenueRes.data.rows?.[0]?.[0] as number) || 0;
        } catch (e) {
            console.log('[YouTube Sync] Revenue data not available for this channel (likely not monetized)');
        }

        return {
            views: views || 0,
            watchTimeHours: Math.round((estimatedMinutesWatched || 0) / 60),
            estimatedRevenue: estimatedRevenue,
            subscriberCount: 0, // Will be filled from channel stats
            subscribersGained: subscribersGained || 0,
            subscribersLost: subscribersLost || 0,
            likes: likes || 0,
            comments: comments || 0,
            shares: shares || 0,
            impressions: 0, // Simplified for now
            impressionsCtr: 0,
            avgViewDuration: averageViewDuration || 0,
            geographyData,
            deviceData,
        };
    } catch (error: any) {
        console.error('[YouTube Analytics] Error fetching analytics:', error.message);
        throw error;
    }
}

/**
 * Calculate date range for period
 */
function getDateRange(days: number): { startDate: string; endDate: string } {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    };
}

/**
 * Sync YouTube data for a specific client
 */
export async function syncYouTubeChannel(clientId: string): Promise<SyncResult> {
    try {
        console.log(`[YouTube Sync] Starting sync for client: ${clientId}`);

        // Get client's YouTube channel
        const youtubeChannel = await prisma.youTubeChannel.findUnique({
            where: { clientId },
            include: { client: true },
        });

        if (!youtubeChannel) {
            return {
                success: false,
                clientId,
                error: 'No YouTube channel connected',
            };
        }

        if (!youtubeChannel.isActive) {
            return {
                success: false,
                clientId,
                channelId: youtubeChannel.channelId,
                error: 'YouTube channel is inactive',
            };
        }

        // Get valid access token
        const accessToken = await getValidAccessToken(youtubeChannel);

        // Fetch channel statistics (current subscriber count)
        const channelStats = await fetchChannelStats(youtubeChannel.channelId, accessToken);

        // Fetch analytics for last 28 days (daily snapshots)
        const { startDate, endDate } = getDateRange(28);
        const analytics = await fetchYouTubeAnalytics(
            youtubeChannel.channelId,
            accessToken,
            startDate,
            endDate
        );

        // Combine channel stats with analytics
        analytics.subscriberCount = channelStats.subscriberCount;

        // Store daily snapshot
        await prisma.youTubeSnapshot.create({
            data: {
                clientId,
                channelId: youtubeChannel.id,
                subscriberCount: analytics.subscriberCount,
                views: analytics.views,
                watchTimeHours: analytics.watchTimeHours,
                estimatedRevenue: analytics.estimatedRevenue,
                likes: analytics.likes,
                comments: analytics.comments,
                shares: analytics.shares,
                impressions: analytics.impressions,
                impressionsCtr: analytics.impressionsCtr,
                avgViewDuration: analytics.avgViewDuration,
                subscribersGained: analytics.subscribersGained,
                subscribersLost: analytics.subscribersLost,
                geographyData: analytics.geographyData || [],
                deviceData: analytics.deviceData || [],
                periodStart: new Date(startDate),
                periodEnd: new Date(endDate),
                periodType: 'DAILY',
                snapshotDate: new Date(),
            },
        });

        // Update channel's last sync time and stats
        await prisma.youTubeChannel.update({
            where: { id: youtubeChannel.id },
            data: {
                lastSyncedAt: new Date(),
                syncStatus: 'COMPLETED',
                syncError: null,
                subscriberCount: analytics.subscriberCount,
                totalViews: channelStats.totalViews,
                totalVideos: channelStats.totalVideos,
            },
        });

        console.log(`[YouTube Sync] Successfully synced channel: ${youtubeChannel.channelId}`);

        return {
            success: true,
            clientId,
            channelId: youtubeChannel.channelId,
        };
    } catch (error: any) {
        console.error(`[YouTube Sync] Error syncing client ${clientId}:`, error.message);

        // Update sync status to failed
        try {
            await prisma.youTubeChannel.updateMany({
                where: { clientId },
                data: {
                    syncStatus: 'FAILED',
                    syncError: error.message,
                },
            });
        } catch (updateError) {
            console.error('[YouTube Sync] Failed to update sync status:', updateError);
        }

        return {
            success: false,
            clientId,
            error: error.message,
        };
    }
}

/**
 * Sync all YouTube channels (for cron job)
 */
export async function syncAllYouTubeChannels(): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: SyncResult[];
}> {
    console.log('[YouTube Sync] Starting batch sync for all channels');

    // Get all active YouTube channels
    const channels = await prisma.youTubeChannel.findMany({
        where: { isActive: true },
        select: { clientId: true, channelId: true },
    });

    console.log(`[YouTube Sync] Found ${channels.length} active channels`);

    const results: SyncResult[] = [];
    let successful = 0;
    let failed = 0;

    // Sync each channel sequentially (to avoid rate limits)
    for (const channel of channels) {
        const result = await syncYouTubeChannel(channel.clientId);
        results.push(result);

        if (result.success) {
            successful++;
        } else {
            failed++;
        }

        // Add delay between syncs to avoid rate limiting (1 second)
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[YouTube Sync] Batch sync completed: ${successful} successful, ${failed} failed`);

    return {
        total: channels.length,
        successful,
        failed,
        results,
    };
}

/**
 * Get dashboard statistics for a client
 */
export async function getYouTubeDashboardStats(
    clientId: string,
    period: number = 28
): Promise<{
    subscribers: { current: number; change: number; trend: 'up' | 'down' | 'neutral' };
    views: { current: number; change: number; trend: 'up' | 'down' | 'neutral' };
    watchTime: { current: number; change: number; trend: 'up' | 'down' | 'neutral' };
    revenue: { current: number; change: number; trend: 'up' | 'down' | 'neutral' };
    lastSyncedAt: Date | null;
}> {
    const { startDate: currentStart, endDate: currentEnd } = getDateRange(period);
    const { startDate: previousStart, endDate: previousEnd } = getDateRange(period * 2);

    // Get current period data
    const currentData = await prisma.youTubeSnapshot.aggregate({
        where: {
            clientId,
            periodStart: { gte: new Date(currentStart) },
            periodEnd: { lte: new Date(currentEnd) },
        },
        _sum: {
            views: true,
            watchTimeHours: true,
            estimatedRevenue: true,
        },
        _avg: {
            subscriberCount: true,
        },
    });

    // Get previous period data for comparison
    const previousData = await prisma.youTubeSnapshot.aggregate({
        where: {
            clientId,
            periodStart: { gte: new Date(previousStart), lt: new Date(currentStart) },
        },
        _sum: {
            views: true,
            watchTimeHours: true,
            estimatedRevenue: true,
        },
        _avg: {
            subscriberCount: true,
        },
    });

    // Get last sync time
    const channel = await prisma.youTubeChannel.findUnique({
        where: { clientId },
        select: { lastSyncedAt: true },
    });

    // Calculate changes and trends
    const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return { change: 0, trend: 'neutral' as const };
        const change = ((current - previous) / previous) * 100;
        const trend: 'up' | 'down' | 'neutral' = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
        return { change: Math.round(change * 10) / 10, trend };
    };

    const subscribers = calculateChange(
        currentData._avg.subscriberCount || 0,
        previousData._avg.subscriberCount || 0
    );

    const views = calculateChange(
        Number(currentData._sum.views || 0),
        Number(previousData._sum.views || 0)
    );

    const watchTime = calculateChange(
        currentData._sum.watchTimeHours || 0,
        previousData._sum.watchTimeHours || 0
    );

    const revenue = calculateChange(
        currentData._sum.estimatedRevenue || 0,
        previousData._sum.estimatedRevenue || 0
    );

    return {
        subscribers: {
            current: Math.round(currentData._avg.subscriberCount || 0),
            ...subscribers,
        },
        views: {
            current: Number(currentData._sum.views || 0),
            ...views,
        },
        watchTime: {
            current: currentData._sum.watchTimeHours || 0,
            ...watchTime,
        },
        revenue: {
            current: Math.round((currentData._sum.estimatedRevenue || 0) * 100) / 100,
            ...revenue,
        },
        distribution: await prisma.youTubeSnapshot.findFirst({
            where: { clientId, periodType: 'DAILY' },
            orderBy: { periodStart: 'desc' },
            select: { geographyData: true, deviceData: true }
        }),
        lastSyncedAt: channel?.lastSyncedAt || null,
    };
}
