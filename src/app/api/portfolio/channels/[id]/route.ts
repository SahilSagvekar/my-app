export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { PortfolioChannel } from '../route';

const CONFIG_PATH = path.join(process.cwd(), 'src/config/portfolioChannels.json');

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

// PATCH /api/portfolio/channels/[id] — update a channel card
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const channels = await readChannels();
        const idx = channels.findIndex((c) => c.id === id);
        if (idx === -1) {
            return NextResponse.json(
                { ok: false, message: 'Channel not found' },
                { status: 404 }
            );
        }

        channels[idx] = {
            ...channels[idx],
            ...(body.name !== undefined && { name: body.name }),
            ...(body.channelUrl !== undefined && { channelUrl: body.channelUrl }),
            ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl }),
            ...(body.followerCount !== undefined && { followerCount: body.followerCount }),
            ...(body.category !== undefined && { category: body.category }),
            ...(body.order !== undefined && { order: body.order }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
            updatedAt: new Date().toISOString(),
        };
        await writeChannels(channels);

        return NextResponse.json({ ok: true, channel: channels[idx] });
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
        const { id } = await params;

        const channels = await readChannels();
        const idx = channels.findIndex((c) => c.id === id);
        if (idx === -1) {
            return NextResponse.json(
                { ok: false, message: 'Channel not found' },
                { status: 404 }
            );
        }

        channels.splice(idx, 1);
        await writeChannels(channels);

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/portfolio/channels/[id]]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}
