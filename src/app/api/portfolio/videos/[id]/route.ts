export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/portfolio/videos/[id] — update a portfolio video
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();

        const video = await prisma.portfolioVideo.findUnique({ where: { id } });
        if (!video) {
            return NextResponse.json(
                { ok: false, message: 'Video not found' },
                { status: 404 }
            );
        }

        const updated = await prisma.portfolioVideo.update({
            where: { id },
            data: {
                ...(body.title !== undefined && { title: body.title }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl }),
                ...(body.thumbnailUrl !== undefined && { thumbnailUrl: body.thumbnailUrl }),
                ...(body.category !== undefined && { category: body.category }),
                ...(body.order !== undefined && { order: body.order }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
            },
        });

        return NextResponse.json({ ok: true, video: updated });
    } catch (err) {
        console.error('[PATCH /api/portfolio/videos/[id]]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}

// DELETE /api/portfolio/videos/[id] — delete a portfolio video
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const video = await prisma.portfolioVideo.findUnique({ where: { id } });
        if (!video) {
            return NextResponse.json(
                { ok: false, message: 'Video not found' },
                { status: 404 }
            );
        }

        await prisma.portfolioVideo.delete({ where: { id } });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[DELETE /api/portfolio/videos/[id]]', err);
        return NextResponse.json(
            { ok: false, message: 'Server error' },
            { status: 500 }
        );
    }
}
