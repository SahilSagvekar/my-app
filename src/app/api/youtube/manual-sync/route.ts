export const dynamic = 'force-dynamic';
// app/api/youtube/manual-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2, resolveClientIdForUser } from '@/lib/auth';
import { syncYouTubeChannel } from '@/lib/youtube-sync-service';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        let clientId = body.clientId;

        // If user is a client, they can only sync their own data
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

        // Admin/Manager can sync any client's data
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

        // Check rate limiting (prevent too frequent syncs)
        const youtubeChannel = await prisma.youTubeChannel.findUnique({
            where: { clientId },
            select: { lastSyncedAt: true },
        });

        if (youtubeChannel?.lastSyncedAt) {
            const timeSinceLastSync = Date.now() - youtubeChannel.lastSyncedAt.getTime();
            const minSyncInterval = 5 * 60 * 1000; // 5 minutes

            if (timeSinceLastSync < minSyncInterval) {
                const waitTime = Math.ceil((minSyncInterval - timeSinceLastSync) / 1000 / 60);
                return NextResponse.json(
                    {
                        error: `Please wait ${waitTime} minute(s) before syncing again`,
                        waitTime,
                    },
                    { status: 429 }
                );
            }
        }

        // Perform sync
        const result = await syncYouTubeChannel(clientId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Sync failed' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'YouTube data synced successfully',
            channelId: result.channelId,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[YouTube Manual Sync] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to sync YouTube data' },
            { status: 500 }
        );
    }
}
