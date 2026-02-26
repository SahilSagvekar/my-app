export const dynamic = 'force-dynamic';
// app/api/youtube/admin/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);

        // Only admin and manager can access this endpoint
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all clients with their YouTube channels
        const clients = await prisma.client.findMany({
            select: {
                id: true,
                name: true,
                companyName: true,
                youtubeChannel: {
                    select: {
                        id: true,
                        channelId: true,
                        channelTitle: true,
                        channelAvatar: true,
                        subscriberCount: true,
                        totalViews: true,
                        totalVideos: true,
                        lastSyncedAt: true,
                        syncStatus: true,
                        isActive: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });

        // Format response
        const formattedClients = clients.map((client) => ({
            clientId: client.id,
            clientName: client.name,
            companyName: client.companyName,
            isConnected: !!client.youtubeChannel,
            channel: client.youtubeChannel
                ? {
                    id: client.youtubeChannel.channelId,
                    title: client.youtubeChannel.channelTitle,
                    avatar: client.youtubeChannel.channelAvatar,
                    subscribers: client.youtubeChannel.subscriberCount,
                    totalViews: client.youtubeChannel.totalViews,
                    totalVideos: client.youtubeChannel.totalVideos,
                    lastSyncedAt: client.youtubeChannel.lastSyncedAt,
                    syncStatus: client.youtubeChannel.syncStatus,
                    isActive: client.youtubeChannel.isActive,
                }
                : null,
        }));

        // Separate connected and not connected
        const connected = formattedClients.filter((c) => c.isConnected);
        const notConnected = formattedClients.filter((c) => !c.isConnected);

        return NextResponse.json({
            success: true,
            total: formattedClients.length,
            connected: connected.length,
            notConnected: notConnected.length,
            clients: formattedClients,
            connectedClients: connected,
            notConnectedClients: notConnected,
        });
    } catch (error: any) {
        console.error('[YouTube Admin Clients] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch clients' },
            { status: 500 }
        );
    }
}
