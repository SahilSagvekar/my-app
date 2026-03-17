// src/lib/social/sync.ts

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
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
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
  });

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
  if (account.tokenExpiry && account.tokenExpiry < new Date()) {
    if (account.refreshToken) {
      const newTokens = await service.refreshToken(decrypt(account.refreshToken));
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: {
          accessToken: encrypt(newTokens.access_token),
          tokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000),
        },
      });
    } else {
      await prisma.socialAccount.update({
        where: { id: accountId },
        data: { isActive: false },
      });
      throw new Error('Token expired and no refresh token available');
    }
  }

  // Sync account stats
  const stats = await service.getAccountStats();
  
  await prisma.socialAccount.update({
    where: { id: accountId },
    data: {
      followerCount: stats.followers,
      lastSyncAt: new Date(),
    },
  });

  // Sync daily analytics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.socialAnalytics.upsert({
    where: {
      socialAccountId_date: {
        socialAccountId: accountId,
        date: today,
      },
    },
    create: {
      socialAccountId: accountId,
      date: today,
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
    update: {
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
    await prisma.socialPost.upsert({
      where: {
        socialAccountId_platformPostId: {
          socialAccountId: accountId,
          platformPostId: post.id,
        },
      },
      create: {
        socialAccountId: accountId,
        platformPostId: post.id,
        postType: post.type,
        title: post.title,
        description: post.description,
        thumbnailUrl: post.thumbnail,
        postUrl: post.url,
        publishedAt: new Date(post.publishedAt),
        views: post.views || 0,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        saves: post.saves,
        watchTime: post.watchTime,
        engagementRate: post.engagementRate,
      },
      update: {
        views: post.views || 0,
        likes: post.likes || 0,
        comments: post.comments || 0,
        shares: post.shares || 0,
        saves: post.saves,
        watchTime: post.watchTime,
        engagementRate: post.engagementRate,
      },
    });
  }

  return { success: true, postssynced: posts.length };
}