export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/portfolio/videos — fetch videos, optionally filtered by category
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get('category');
        const showAll = searchParams.get('all') === 'true'; // admin: fetch all including inactive

        const where: any = {};
        if (!showAll) {
            where.isActive = true;
        }
        if (category) {
            where.category = category;
        }

        const videos = await prisma.portfolioVideo.findMany({
            where,
            orderBy: { order: 'asc' },
        });

        return NextResponse.json({ ok: true, videos });
    } catch (err) {
        console.error('[GET /api/portfolio/videos]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

// POST /api/portfolio/videos — admin: add a new portfolio video
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, description, videoUrl, thumbnailUrl, category, order } = body;

        if (!title || !videoUrl || !category) {
            return NextResponse.json(
                { ok: false, message: 'Title, videoUrl, and category are required' },
                { status: 400 }
            );
        }

        const video = await prisma.portfolioVideo.create({
            data: {
                title,
                description: description || '',
                videoUrl,
                thumbnailUrl: thumbnailUrl || null,
                category,
                order: order ?? 0,
            },
        });

        return NextResponse.json({ ok: true, video });
    } catch (err) {
        console.error('[POST /api/portfolio/videos]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}
