// src/app/api/admin/social-analytics-overview/route.ts
//
// Admin-only, all-clients version of /api/social/analytics. That route
// returns one client's overview; this one returns one summary row per
// client, so the admin portal can show every client's social performance
// on a single screen without switching between them.
//
// Reuses the same "latest vs previous daily row per account" aggregation
// logic as the per-client route, just grouped by clientId afterward
// instead of assuming a single client.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { socialAccount, socialAnalytics, client as clientTable } from '@/lib/db/schema';
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '28d';
    const days = parseInt(range.replace('d', '')) || 28;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    const startDateStr = startDate.toISOString().split('T')[0];

    // All clients, so we can still show clients with zero connected
    // accounts (as an empty/needs-setup row) rather than silently omitting them.
    const clients = await db
      .select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName })
      .from(clientTable)
      .where(eq(clientTable.status, 'active'));

    // All connected social accounts across every client, in one query.
    const accounts = await db
      .select({
        id: socialAccount.id,
        clientId: socialAccount.clientId,
        platform: socialAccount.platform,
        followerCount: socialAccount.followerCount,
        isActive: socialAccount.isActive,
        lastSyncAt: socialAccount.lastSyncAt,
      })
      .from(socialAccount)
      .where(eq(socialAccount.isActive, true));

    const accountIds = accounts.map((a) => a.id);
    const accountToClient = new Map(accounts.map((a) => [a.id, a.clientId]));

    const dailyAnalytics = accountIds.length > 0
      ? await db
          .select()
          .from(socialAnalytics)
          .where(and(inArray(socialAnalytics.socialAccountId, accountIds), gte(socialAnalytics.date, startDateStr)))
          .orderBy(asc(socialAnalytics.date))
      : [];

    // Latest + previous daily row per ACCOUNT first (same logic as the
    // per-client route), then roll those up into per-CLIENT totals below.
    const latestByAccount = new Map<string, (typeof dailyAnalytics)[0]>();
    const previousByAccount = new Map<string, (typeof dailyAnalytics)[0]>();

    dailyAnalytics.forEach((record) => {
      const existing = latestByAccount.get(record.socialAccountId);
      if (!existing || record.date > existing.date) {
        if (existing) previousByAccount.set(record.socialAccountId, existing);
        latestByAccount.set(record.socialAccountId, record);
      }
    });

    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    type ClientTotals = {
      totalFollowers: number;
      totalViews: number;
      totalLikes: number;
      totalComments: number;
      prevFollowers: number;
      prevViews: number;
      platforms: Set<string>;
      accountCount: number;
      lastSyncAt: string | null;
    };
    const byClient = new Map<string, ClientTotals>();

    const ensure = (clientId: string): ClientTotals => {
      let t = byClient.get(clientId);
      if (!t) {
        t = {
          totalFollowers: 0, totalViews: 0, totalLikes: 0, totalComments: 0,
          prevFollowers: 0, prevViews: 0, platforms: new Set(), accountCount: 0, lastSyncAt: null,
        };
        byClient.set(clientId, t);
      }
      return t;
    };

    accounts.forEach((acc) => {
      const t = ensure(acc.clientId);
      t.accountCount += 1;
      t.platforms.add(acc.platform);
      if (acc.lastSyncAt && (!t.lastSyncAt || acc.lastSyncAt > t.lastSyncAt)) {
        t.lastSyncAt = acc.lastSyncAt;
      }
    });

    latestByAccount.forEach((record, accountId) => {
      const clientId = accountToClient.get(accountId);
      if (!clientId) return;
      const t = ensure(clientId);
      t.totalFollowers += record.followers;
      t.totalViews += record.views;
      t.totalLikes += record.likes;
      t.totalComments += record.comments;

      const prev = previousByAccount.get(accountId);
      if (prev) {
        t.prevFollowers += prev.followers;
        t.prevViews += prev.views;
      }
    });

    const rows = clients.map((c) => {
      const t = byClient.get(c.id);
      if (!t) {
        return {
          clientId: c.id,
          clientName: c.name,
          companyName: c.companyName,
          connected: false,
          accountCount: 0,
          platforms: [] as string[],
          totalFollowers: 0,
          totalViews: 0,
          totalLikes: 0,
          totalComments: 0,
          followersChange: 0,
          viewsChange: 0,
          lastSyncAt: null as string | null,
        };
      }
      return {
        clientId: c.id,
        clientName: c.name,
        companyName: c.companyName,
        connected: true,
        accountCount: t.accountCount,
        platforms: Array.from(t.platforms),
        totalFollowers: t.totalFollowers,
        totalViews: t.totalViews,
        totalLikes: t.totalLikes,
        totalComments: t.totalComments,
        followersChange: calcChange(t.totalFollowers, t.prevFollowers),
        viewsChange: calcChange(t.totalViews, t.prevViews),
        lastSyncAt: t.lastSyncAt,
      };
    });

    // Connected clients first (most relevant), then alphabetical within each group.
    rows.sort((a, b) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1;
      return a.clientName.localeCompare(b.clientName);
    });

    return NextResponse.json({
      ok: true,
      range,
      clients: rows,
      summary: {
        totalClients: rows.length,
        connectedClients: rows.filter((r) => r.connected).length,
        totalFollowers: rows.reduce((s, r) => s + r.totalFollowers, 0),
        totalViews: rows.reduce((s, r) => s + r.totalViews, 0),
      },
    });
  } catch (error: any) {
    console.error('[ADMIN SOCIAL ANALYTICS OVERVIEW] Error:', error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status || 500 });
  }
}