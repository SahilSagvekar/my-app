// src/lib/social/sync.ts

import { getDbHttp } from '@/lib/db';
import { socialAccount, socialAnalytics, socialPost } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { createId } from '@/lib/db/id';
import { decrypt, encrypt } from '@/lib/encryption';
import { YouTubeService } from './youtube';
import { InstagramService } from './instagram';
import { TikTokService } from './tiktok';
import { FacebookService } from './facebook';

const services = {
  youtube: YouTubeService,
  instagram: InstagramService,
  tiktok: TikTokService,
  facebook: FacebookService,
};

export async function syncSocialAccount(accountId: string) {
  const db = getDbHttp();
  const [account] = await db.select().from(socialAccount)
    .where(eq(socialAccount.id, accountId)).limit(1);

  if (!account || !account.isActive) {
    throw new Error('Account not found or inactive');
  }

  const Service = services[account.platform as keyof typeof services];
  if (!Service) {
    throw new Error(`Unknown platform: ${account.platform}`);
  }

  const accessToken = decrypt(account.accessToken);
  const service = new Service(accessToken);

  // Check if token needs refresh
  if (account.tokenExpiry && new Date(account.tokenExpiry) < new Date()) {
    if (account.refreshToken) {
      const newTokens = await service.refreshToken(decrypt(account.refreshToken));
      // TODO(prisma-migration): `encrypt` is referenced here but was never imported in the
      // original Prisma version of this file either — pre-existing bug, left unchanged.
      await db.update(socialAccount)
        .set({
          accessToken: encrypt(newTokens.access_token),
          tokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(socialAccount.id, accountId));
    } else {
      await db.update(socialAccount)
        .set({ isActive: false, updatedAt: new Date().toISOString() })
        .where(eq(socialAccount.id, accountId));
      throw new Error('Token expired and no refresh token available');
    }
  }

  // Sync account stats
  const stats = await service.getAccountStats();

  await db.update(socialAccount)
    .set({
      followerCount: stats.followers,
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(socialAccount.id, accountId));

  // Sync daily analytics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = today.toISOString().split('T')[0];

  await db.insert(socialAnalytics).values({
    id: createId(),
    socialAccountId: accountId,
    date: todayStr,
    followers: stats.followers,
    followersGained: stats.followersGained || 0,
    views: stats.views || 0,
    likes: stats.likes || 0,
    comments: stats.comments || 0,
    shares: stats.shares || 0,
    impressions: stats.impressions,
    reach: stats.reach,
    engagementRate: stats.engagementRate,
  }).onConflictDoUpdate({
    target: [socialAnalytics.socialAccountId, socialAnalytics.date],
    set: {
      followers: stats.followers,
      followersGained: stats.followersGained || 0,
      views: stats.views || 0,
      likes: stats.likes || 0,
      comments: stats.comments || 0,
      shares: stats.shares || 0,
      impressions: stats.impressions,
      reach: stats.reach,
      engagementRate: stats.engagementRate,
    },
  });

  // Sync recent posts
  const posts = await service.getRecentPosts(50);
  
  for (const post of posts) {
    await db.insert(socialPost).values({
      id: createId(),
      socialAccountId: accountId,
      platformPostId: post.id,
      postType: post.type,
      title: post.title,
      description: post.description,
      thumbnailUrl: post.thumbnail,
      postUrl: post.url,
      publishedAt: new Date(post.publishedAt).toISOString(),
      views: post.views || 0,
      likes: post.likes || 0,
      comments: post.comments || 0,
      shares: post.shares || 0,
      saves: post.saves,
      watchTime: post.watchTime,
      engagementRate: post.engagementRate,
      updatedAt: new Date().toISOString(),
    }).onConflictDoUpdate({
      target: [socialPost.socialAccountId, socialPost.platformPostId],
      set: {
        views: post.views || 0,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        saves: post.saves,
        watchTime: post.watchTime,
        engagementRate: post.engagementRate,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return { success: true, postssynced: posts.length };
}

export async function syncClientAccounts(clientId: string) {
  const db = getDbHttp();
  const accounts = await db
    .select({ id: socialAccount.id })
    .from(socialAccount)
    .where(and(eq(socialAccount.clientId, clientId), eq(socialAccount.isActive, true)));

  const results = await Promise.allSettled(
    accounts.map(({ id }) => syncSocialAccount(id)),
  );
  const synced = results.filter((result) => result.status === 'fulfilled').length;
  const failures = results.flatMap((result) =>
    result.status === 'rejected'
      ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
      : [],
  );

  return { success: failures.length === 0, synced, failed: failures.length, failures };
}
