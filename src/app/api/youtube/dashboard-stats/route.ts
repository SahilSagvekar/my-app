export const dynamic = 'force-dynamic';
// app/api/youtube/dashboard-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { getYouTubeDashboardStats } from '@/lib/youtube-sync-service';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const period = parseInt(searchParams.get('period') || '28');
        let clientId = searchParams.get('clientId');

        // If user is a client, they can only see their own data
        if (user.role === 'client') {
            // 🔥 FIX: Use resolveClientIdForUser for multi-user client support
            const resolvedClientId = await resolveClientIdForUser(user.id);

            if (!resolvedClientId) {
                return NextResponse.json(
                    { error: 'Client profile not found' },
                    { status: 404 }
                );
            }

            clientId = resolvedClientId;
        }

        // Admin/Manager can view any client's data
        if ((user.role === 'admin' || user.role === 'manager') && !clientId) {
            return NextResponse.json(
                { error: 'clientId is required for admin users' },
                { status: 400 }
            );
        }

        if (!clientId) {
            return NextResponse.json(
                { error: 'Client ID not found' },
                { status: 400 }
            );
        }

        // Check if client has YouTube connected
        const youtubeChannel = await prisma.youTubeChannel.findUnique({
            where: { clientId },
            select: { id: true, channelTitle: true, channelId: true },
        });

        if (!youtubeChannel) {
            return NextResponse.json(
                {
                    error: 'No YouTube channel connected',
                    connected: false
                },
                { status: 404 }
            );
        }

        // Get dashboard stats
        const stats = await getYouTubeDashboardStats(clientId, period);

        return NextResponse.json({
            success: true,
            connected: true,
            channel: {
                id: youtubeChannel.channelId,
                title: youtubeChannel.channelTitle,
            },
            stats,
            period,
        });
    } catch (error: any) {
        console.error('[YouTube Dashboard Stats] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch dashboard stats' },
            { status: 500 }
        );
    }
}
