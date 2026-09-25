// src/lib/social/windsor.ts
//
// Pulls social analytics from Windsor.ai's Connectors API
// (https://windsor.ai/api-documentation/) for every active SocialAccount
// and upserts one SocialAnalytics row per (account, day) — same table the
// native OAuth path (src/lib/social/sync.ts) already writes to, so the
// existing analytics UI doesn't need to know or care which source filled it.
//
// One Windsor API key covers every connected account; Windsor tells them
// apart per-row via an account-id field on each connector. SocialAccount's
// existing `platformId` (the platform-native page/channel/profile id) is
// used as that join key — connect the account in Windsor with the same id
// already stored on SocialAccount.platformId.

import { getDbHttp } from '@/lib/db';
import { socialAccount, socialAnalytics } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createId } from '@/lib/db/id';

const WINDSOR_BASE = 'https://connectors.windsor.ai';

type WindsorPlatform = 'instagram' | 'facebook' | 'tiktok' | 'youtube';

// Windsor connector slug per platform. Confirm these against your Windsor
// workspace (Connectors list) before relying on this — Windsor names its
// organic-social connectors slightly differently per platform and this
// wasn't verified against a live account.
const CONNECTOR_BY_PLATFORM: Record<WindsorPlatform, string> = {
  instagram: 'instagram',
  facebook: 'facebook_organic',
  tiktok: 'tiktok_organic',
  youtube: 'youtube',
};

// Windsor's field for "which connected account is this row" per connector.
// Confirm against windsor.ai/data-field/<connector> — this defaults to
// account_id but some connectors expose it under a different name.
const ACCOUNT_ID_FIELD: Record<WindsorPlatform, string> = {
  instagram: 'account_id',
  facebook: 'account_id',
  tiktok: 'account_id',
  youtube: 'account_id',
};

// Windsor field name -> SocialAnalytics column, per platform. Confirm
// against Windsor's per-connector field reference before trusting the
// numbers — verifySyncedRow() below fails loudly if none of these match
// what Windsor actually returns, instead of silently writing zeros.
const FIELD_MAP: Record<WindsorPlatform, Partial<Record<
  'followers' | 'followersGained' | 'followersLost' | 'views' | 'likes' | 'comments' | 'shares' | 'impressions' | 'reach',
  string
>>> = {
  instagram: {
    followers: 'followers', reach: 'reach', impressions: 'impressions',
    likes: 'likes', comments: 'comments', shares: 'shares',
  },
  facebook: {
    followers: 'page_fans', impressions: 'page_impressions', reach: 'page_impressions_unique',
    likes: 'post_reactions_like_total', comments: 'post_comments', shares: 'post_shares',
  },
  tiktok: {
    followers: 'followers', followersGained: 'follower_gains', followersLost: 'follower_losses',
    views: 'video_views', likes: 'likes', comments: 'comments', shares: 'shares',
  },
  youtube: {
    followers: 'subscribers', views: 'views', likes: 'likes',
    comments: 'comments', shares: 'shares', impressions: 'impressions',
  },
};

export interface WindsorSyncResult {
  platform: WindsorPlatform;
  connectedAccounts: number;
  rowsWritten: number;
  unmatchedWindsorAccountIds: string[];
  error?: string;
}

async function fetchWindsorRows(platform: WindsorPlatform, dateFrom: string, dateTo: string): Promise<any[]> {
  const connector = CONNECTOR_BY_PLATFORM[platform];
  const map = FIELD_MAP[platform];
  const fields = ['date', ACCOUNT_ID_FIELD[platform], ...new Set(Object.values(map))].join(',');
  const url = `${WINDSOR_BASE}/${connector}?api_key=${process.env.WINDSOR_API_KEY}&fields=${fields}&date_from=${dateFrom}&date_to=${dateTo}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Windsor ${connector} request failed: ${res.status} ${await res.text().catch(() => '')}`);
  }
  const data: any = await res.json();
  const rows = Array.isArray(data) ? data : (data?.data ?? []);

  // Fail loud, not silent: if Windsor returned rows but NONE of the mapped
  // fields for this platform ever appear, the field names above are wrong
  // for this connector version and every row would otherwise sync as zeros.
  if (rows.length > 0) {
    const sample = rows[0];
    const mappedKeys = Object.values(map);
    const anyFieldPresent = mappedKeys.some((key) => key in sample);
    if (!anyFieldPresent) {
      throw new Error(
        `Windsor ${connector}: none of the expected fields (${mappedKeys.join(', ')}) ` +
        `were found on the response. Actual keys: ${Object.keys(sample).join(', ')}. ` +
        `Update FIELD_MAP in src/lib/social/windsor.ts to match.`
      );
    }
  }

  return rows;
}

/**
 * Pulls a date range (defaults to yesterday) of analytics from Windsor for
 * every active SocialAccount whose platform Windsor covers, and upserts
 * SocialAnalytics rows keyed by (socialAccountId, date).
 */
export async function syncWindsorAnalytics(dateFrom?: string, dateTo?: string): Promise<WindsorSyncResult[]> {
  if (!process.env.WINDSOR_API_KEY) {
    throw new Error('WINDSOR_API_KEY not configured');
  }

  const db = getDbHttp();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const from = dateFrom || yesterday;
  const to = dateTo || yesterday;

  const accounts = await db.select().from(socialAccount).where(eq(socialAccount.isActive, true));

  const results: WindsorSyncResult[] = [];

  for (const platform of Object.keys(CONNECTOR_BY_PLATFORM) as WindsorPlatform[]) {
    const platformAccounts = accounts.filter((a) => a.platform === platform);
    if (platformAccounts.length === 0) continue;

    const accountByPlatformId = new Map(platformAccounts.map((a) => [a.platformId, a]));
    const unmatchedWindsorAccountIds = new Set<string>();
    let rowsWritten = 0;

    try {
      const rows = await fetchWindsorRows(platform, from, to);
      const accountIdField = ACCOUNT_ID_FIELD[platform];
      const map = FIELD_MAP[platform];

      for (const row of rows) {
        const windsorAccountId = String(row[accountIdField] ?? '');
        const account = accountByPlatformId.get(windsorAccountId);
        if (!account) {
          if (windsorAccountId) unmatchedWindsorAccountIds.add(windsorAccountId);
          continue;
        }

        const date = row.date;
        if (!date) continue;

        const num = (field?: string) => (field && row[field] != null ? Number(row[field]) : undefined);
        const followers = num(map.followers) ?? account.followerCount;
        const likes = num(map.likes) ?? 0;
        const comments = num(map.comments) ?? 0;
        const shares = num(map.shares) ?? 0;
        const values = {
          followers,
          followersGained: num(map.followersGained) ?? 0,
          followersLost: num(map.followersLost) ?? 0,
          views: num(map.views) ?? 0,
          likes,
          comments,
          shares,
          impressions: num(map.impressions) ?? null,
          reach: num(map.reach) ?? null,
          engagementRate: followers > 0 ? (likes + comments + shares) / followers : null,
        };

        await db.insert(socialAnalytics).values({
          id: createId(),
          socialAccountId: account.id,
          date,
          ...values,
        }).onConflictDoUpdate({
          target: [socialAnalytics.socialAccountId, socialAnalytics.date],
          set: values,
        });
        rowsWritten++;

        await db.update(socialAccount)
          .set({ followerCount: followers, lastSyncAt: new Date().toISOString() })
          .where(eq(socialAccount.id, account.id));
      }

      results.push({
        platform,
        connectedAccounts: platformAccounts.length,
        rowsWritten,
        unmatchedWindsorAccountIds: [...unmatchedWindsorAccountIds],
      });
    } catch (err: any) {
      console.error(`[windsor-sync] ${platform} failed:`, err.message || err);
      results.push({
        platform,
        connectedAccounts: platformAccounts.length,
        rowsWritten,
        unmatchedWindsorAccountIds: [...unmatchedWindsorAccountIds],
        error: err.message || String(err),
      });
    }
  }

  return results;
}
