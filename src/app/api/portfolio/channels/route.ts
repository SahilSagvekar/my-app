export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { portfolioChannel as portfolioChannelTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, asc, eq } from 'drizzle-orm';
import { scrapeYoutubeChannelInfo } from '@/lib/scrapeYoutubeChannel';
import { requirePortfolioAdmin } from '@/lib/portfolio-auth';

export interface PortfolioChannel {
    id: string;
    name: string;
    channelUrl: string;
    avatarUrl: string | null;
    followerCount: string;
    category: string;
    order: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// GET /api/portfolio/channels — fetch channels, optionally filtered by category
export async function GET(req: NextRequest) {
    try {
        const db = getDbHttp();
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');
        const showAll = searchParams.get('all') === 'true'; // admin: fetch all including inactive
        if (showAll) {
            const denied = requirePortfolioAdmin(req);
            if (denied) return denied;
        }

        const conditions = [];
        if (!showAll) conditions.push(eq(portfolioChannelTable.isActive, true));
        if (category) conditions.push(eq(portfolioChannelTable.category, category));

        const channels = await db
            .select()
            .from(portfolioChannelTable)
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(asc(portfolioChannelTable.order), asc(portfolioChannelTable.createdAt));

        return NextResponse.json({ ok: true, channels });
    } catch (err) {
        console.error('[GET /api/portfolio/channels]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

// POST /api/portfolio/channels — admin: add a new channel card.
// Name + avatar are auto-fetched from the channel URL unless provided;
// follower count is always taken as-is (manual, not scraped).
export async function POST(req: NextRequest) {
    try {
        const denied = requirePortfolioAdmin(req);
        if (denied) return denied;
        const db = getDbHttp();
        const body = await req.json();
        const { channelUrl, followerCount, category, order } = body;
        let { name, avatarUrl } = body;

        if (!channelUrl || !category) {
            return NextResponse.json(
                { ok: false, message: 'Channel URL and category are required' },
                { status: 400 }
            );
        }

        let scrapeFailed = false;
        if (!name || !avatarUrl) {
            const scraped = await scrapeYoutubeChannelInfo(channelUrl);
            name = name || scraped.name;
            avatarUrl = avatarUrl || scraped.avatarUrl;
            if (!scraped.name && !scraped.avatarUrl) scrapeFailed = true;
        }

        const now = new Date().toISOString();
        const [channel] = await db.insert(portfolioChannelTable).values({
            id: createId(),
            name: name || channelUrl,
            channelUrl,
            avatarUrl: avatarUrl || null,
            followerCount: followerCount || '',
            category,
            order: order ?? 0,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        }).returning();

        return NextResponse.json({ ok: true, channel, scrapeFailed });
    } catch (err) {
        console.error('[POST /api/portfolio/channels]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}