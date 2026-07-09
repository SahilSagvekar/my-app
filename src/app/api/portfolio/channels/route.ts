export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { scrapeYoutubeChannelInfo } from '@/lib/scrapeYoutubeChannel';

const CONFIG_PATH = path.join(process.cwd(), 'src/app/config/portfolioChannels.json');

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

async function readChannels(): Promise<PortfolioChannel[]> {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writeChannels(channels: PortfolioChannel[]) {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(channels, null, 4), 'utf8');
}

// GET /api/portfolio/channels — fetch channels, optionally filtered by category
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');
        const showAll = searchParams.get('all') === 'true'; // admin: fetch all including inactive

        let channels = await readChannels();
        if (!showAll) channels = channels.filter((c) => c.isActive);
        if (category) channels = channels.filter((c) => c.category === category);
        channels.sort((a, b) => a.order - b.order);

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

        const channels = await readChannels();
        const now = new Date().toISOString();
        const channel: PortfolioChannel = {
            id: randomUUID(),
            name: name || channelUrl,
            channelUrl,
            avatarUrl: avatarUrl || null,
            followerCount: followerCount || '',
            category,
            order: order ?? 0,
            isActive: true,
            createdAt: now,
            updatedAt: now,
        };
        channels.push(channel);
        await writeChannels(channels);

        return NextResponse.json({ ok: true, channel, scrapeFailed });
    } catch (err) {
        console.error('[POST /api/portfolio/channels]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}
