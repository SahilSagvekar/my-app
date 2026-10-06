export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { portfolioChannel as portfolioChannelTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { scrapeYoutubeChannelInfo } from '@/lib/scrapeYoutubeChannel';
import { requirePortfolioAdmin } from '@/lib/portfolio-auth';

// PATCH /api/portfolio/channels/[id] — update a channel card
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const denied = requirePortfolioAdmin(req);
        if (denied) return denied;
        const db = getDbHttp();
        const { id } = await params;
        const body = await req.json();

        const updates: Record<string, any> = { updatedAt: new Date().toISOString() };
        if (body.name !== undefined) updates.name = body.name;
        if (body.channelUrl !== undefined) updates.channelUrl = body.channelUrl;
        if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
        if (body.followerCount !== undefined) updates.followerCount = body.followerCount;
        if (body.category !== undefined) updates.category = body.category;
        if (body.order !== undefined) updates.order = body.order;
        if (body.isActive !== undefined) updates.isActive = body.isActive;

        // The edit dialog only exposes the URL + follower count. If the URL changed, refresh
        // the name/avatar from it — otherwise a channel whose first scrape failed (name = raw
        // URL) could never be fixed, despite the "edit it to fix" hint shown on add.
        if (body.channelUrl !== undefined && body.name === undefined && body.avatarUrl === undefined) {
            const [current] = await db.select().from(portfolioChannelTable)
                .where(eq(portfolioChannelTable.id, id)).limit(1);
            if (current && current.channelUrl !== body.channelUrl) {
                const scraped = await scrapeYoutubeChannelInfo(body.channelUrl);
                if (scraped.name) updates.name = scraped.name;
                if (scraped.avatarUrl) updates.avatarUrl = scraped.avatarUrl;
            }
        }

        const [channel] = await db
            .update(portfolioChannelTable)
            .set(updates)
            .where(eq(portfolioChannelTable.id, id))
            .returning();

        if (!channel) {
            return NextResponse.json(
                { ok: false, message: 'Channel not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ ok: true, channel });
    } catch (err) {
        console.error('[PATCH /api/portfolio/channels/[id]]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/portfolio/channels/[id] — delete a channel card
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const denied = requirePortfolioAdmin(req);
        if (denied) return denied;
        const db = getDbHttp();
        const { id } = await params;

        const [deleted] = await db
            .delete(portfolioChannelTable)
            .where(eq(portfolioChannelTable.id, id))
            .returning();

        if (!deleted) {
            return NextResponse.json(
                { ok: false, message: 'Channel not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/portfolio/channels/[id]]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}