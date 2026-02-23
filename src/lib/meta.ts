// src/lib/meta.ts
import { prisma } from "@/lib/prisma";
import { MetaProfile, MetaMedia } from "@/types/meta";

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

export class MetaService {
    /**
     * Exchange short-lived token for 60-day long-lived token
     */
    static async getLongLivedToken(shortToken: string) {
        const res = await fetch(
            `${META_GRAPH_URL}/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${process.env.META_APP_ID}&` +
            `client_secret=${process.env.META_APP_SECRET}&` +
            `fb_exchange_token=${shortToken}`
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Failed to get long-lived token: ${err.error?.message || res.statusText}`);
        }

        return await res.json();
    }

    /**
     * Refresh long-lived token (can be refreshed once per day if at least 24h old)
     */
    static async refreshToken(accessToken: string) {
        const res = await fetch(
            `${META_GRAPH_URL}/oauth/access_token?` +
            `grant_type=fb_exchange_token&` +
            `client_id=${process.env.META_APP_ID}&` +
            `fb_exchange_token=${accessToken}`
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Failed to refresh token: ${err.error?.message || res.statusText}`);
        }

        return await res.json();
    }

    /**
     * Get Instagram Business Account linked to a Facebook Page
     */
    static async getInstagramAccount(pageId: string, accessToken: string): Promise<string | null> {
        const res = await fetch(
            `${META_GRAPH_URL}/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Failed to get IG account: ${err.error?.message || res.statusText}`);
        }

        const data = await res.json();
        return data.instagram_business_account?.id || null;
    }

    /**
     * Get IB Page list for the user
     */
    static async getPages(accessToken: string) {
        const res = await fetch(
            `${META_GRAPH_URL}/me/accounts?access_token=${accessToken}`
        );
        if (!res.ok) throw new Error("Failed to fetch FB pages");
        return await res.json();
    }

    /**
     * Get IG profile info
     */
    static async getProfile(igAccountId: string, accessToken: string): Promise<MetaProfile> {
        const res = await fetch(
            `${META_GRAPH_URL}/${igAccountId}?fields=username,name,profile_picture_url,followers_count,follows_count,media_count&access_token=${accessToken}`
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Failed to get profile: ${err.error?.message || res.statusText}`);
        }

        return await res.json();
    }

    /**
     * Get 28-day account insights
     */
    static async getInsights(igAccountId: string, accessToken: string) {
        const metrics = [
            "impressions",
            "reach",
            "follower_count"
        ].join(",");

        const res = await fetch(
            `${META_GRAPH_URL}/${igAccountId}/insights?metric=${metrics}&period=day&since=${Math.floor(Date.now() / 1000) - 28 * 24 * 60 * 60}&until=${Math.floor(Date.now() / 1000)}&access_token=${accessToken}`
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Failed to get insights: ${err.error?.message || res.statusText}`);
        }

        return await res.json();
    }

    /**
     * Get recent media with per-post metrics
     */
    static async getRecentMedia(igAccountId: string, accessToken: string, limit = 20): Promise<MetaMedia[]> {
        const res = await fetch(
            `${META_GRAPH_URL}/${igAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${accessToken}`
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Failed to get media: ${err.error?.message || res.statusText}`);
        }

        const mediaResponse = await res.json();
        const mediaItems = mediaResponse.data || [];

        // For each media, fetch insights
        const mediaWithInsights = await Promise.all(
            mediaItems.map(async (item: any) => {
                try {
                    const isReel = item.media_type === 'VIDEO' || item.caption?.toLowerCase().includes('#reels');
                    const metrics = isReel
                        ? "reach,saved,video_views"
                        : "impressions,reach,saved";

                    const insightsRes = await fetch(
                        `${META_GRAPH_URL}/${item.id}/insights?metric=${metrics}&access_token=${accessToken}`
                    );

                    if (insightsRes.ok) {
                        const insightsData = await insightsRes.json();
                        const stats: any = {};
                        insightsData.data.forEach((m: any) => stats[m.name] = m.values?.[0]?.value || 0);
                        return { ...item, insights: stats };
                    }
                } catch (e) {
                    // Some media might not support certain metrics
                }
                return item;
            })
        );

        return mediaWithInsights;
    }

    /**
     * Get audience demographics
     */
    static async getAudienceDemographics(igAccountId: string, accessToken: string) {
        const metrics = ["audience_gender_age", "audience_country", "audience_city"].join(",");
        const res = await fetch(
            `${META_GRAPH_URL}/${igAccountId}/insights?metric=${metrics}&period=lifetime&access_token=${accessToken}`
        );

        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Failed to get demographics: ${err.error?.message || res.statusText}`);
        }

        return await res.json();
    }

    /**
     * Sync a single Meta account
     */
    static async syncAccount(clientId: string) {
        try {
            const account = await prisma.metaAccount.findUnique({
                where: { clientId },
            });

            if (!account || !account.isActive) {
                return { success: false, error: "Meta account not found or inactive" };
            }

            // 1. Refresh token if expiring within 7 days
            let token = account.accessToken;
            const sevenDays = 7 * 24 * 60 * 60 * 1000;
            if (account.tokenExpiry.getTime() - Date.now() < sevenDays) {
                try {
                    const newToken = await this.refreshToken(token);
                    token = newToken.access_token;
                    await prisma.metaAccount.update({
                        where: { id: account.id },
                        data: {
                            accessToken: token,
                            tokenExpiry: new Date(Date.now() + newToken.expires_in * 1000),
                        }
                    });
                } catch (e) {
                    console.error("Token refresh failed during sync", e);
                }
            }

            await prisma.metaAccount.update({
                where: { id: account.id },
                data: { syncStatus: 'SYNCING', syncError: null },
            });

            // 2. Fetch Profile Info
            const profile = await this.getProfile(account.instagramId!, token);

            // 3. Fetch Insights (28d)
            const insightsData = await this.getInsights(account.instagramId!, token);

            const aggregated = {
                impressions: 0,
                reach: 0,
                followersGained: 0,
                engagement: 0,
            };

            insightsData.data.forEach((metric: any) => {
                const totalValue = metric.values.reduce((sum: number, v: any) => sum + v.value, 0);
                if (metric.name === 'impressions') aggregated.impressions = totalValue;
                if (metric.name === 'reach') aggregated.reach = totalValue;
                if (metric.name === 'follower_count') aggregated.followersGained = totalValue;
            });

            // 4. Fetch Recent Media & Demographics
            const media = await this.getRecentMedia(account.instagramId!, token, 20);
            const demographicsData = await this.getAudienceDemographics(account.instagramId!, token);

            aggregated.engagement = media.reduce((sum, item) =>
                sum + (item.like_count || 0) + (item.comments_count || 0) + (item.insights?.saved || 0), 0);

            // 5. Update DB
            await prisma.metaAccount.update({
                where: { id: account.id },
                data: {
                    username: profile.username,
                    profilePicture: profile.profile_picture_url,
                    followerCount: profile.followers_count,
                    followingCount: profile.follows_count,
                    mediaCount: profile.media_count,
                    lastSyncedAt: new Date(),
                    syncStatus: 'COMPLETED',
                },
            });

            await prisma.metaSnapshot.upsert({
                where: {
                    metaAccountId_dateRange: {
                        metaAccountId: account.id,
                        dateRange: '28d',
                    },
                },
                create: {
                    metaAccountId: account.id,
                    clientId: account.clientId,
                    impressions: BigInt(aggregated.impressions),
                    reach: BigInt(aggregated.reach),
                    followerCount: profile.followers_count,
                    followersGained: aggregated.followersGained,
                    engagement: aggregated.engagement,
                    topPosts: media as any,
                    demographics: demographicsData as any,
                    periodStart: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
                    periodEnd: new Date(),
                    dateRange: '28d',
                },
                update: {
                    impressions: BigInt(aggregated.impressions),
                    reach: BigInt(aggregated.reach),
                    followerCount: profile.followers_count,
                    followersGained: aggregated.followersGained,
                    engagement: aggregated.engagement,
                    topPosts: media as any,
                    demographics: demographicsData as any,
                    periodEnd: new Date(),
                    snapshotDate: new Date(),
                },
            });

            return { success: true };
        } catch (error: any) {
            console.error(`Meta sync failed for client ${clientId}:`, error);
            await prisma.metaAccount.updateMany({
                where: { clientId },
                data: {
                    syncStatus: 'FAILED',
                    syncError: error.message?.slice(0, 500),
                },
            }).catch(console.error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sync all active Meta accounts
     */
    static async syncAllAccounts() {
        const accounts = await prisma.metaAccount.findMany({
            where: { isActive: true },
        });

        const results = [];
        for (const account of accounts) {
            const result = await this.syncAccount(account.clientId);
            results.push({ clientId: account.clientId, ...result });
            await new Promise(r => setTimeout(r, 1000));
        }
        return results;
    }
}
