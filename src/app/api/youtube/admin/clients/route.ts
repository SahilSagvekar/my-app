export const dynamic = 'force-dynamic';
// app/api/youtube/admin/clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { db } from '@/lib/db';
import { client as clientTable, youTubeChannel } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);

        // Only admin and manager can access this endpoint
        if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all clients with their YouTube channels
        // NOTE: YouTubeChannel has a unique index on clientId (1:1 with Client),
        // even though relations.ts labels it `many()` — see schema.ts.
        const rows = await db.select({
            clientId: clientTable.id,
            clientName: clientTable.name,
            companyName: clientTable.companyName,
            channelPk: youTubeChannel.id,
            channelId: youTubeChannel.channelId,
            channelTitle: youTubeChannel.channelTitle,
            channelAvatar: youTubeChannel.channelAvatar,
            subscriberCount: youTubeChannel.subscriberCount,
            totalViews: youTubeChannel.totalViews,
            totalVideos: youTubeChannel.totalVideos,
            lastSyncedAt: youTubeChannel.lastSyncedAt,
            syncStatus: youTubeChannel.syncStatus,
            isActive: youTubeChannel.isActive,
        })
            .from(clientTable)
            .leftJoin(youTubeChannel, eq(youTubeChannel.clientId, clientTable.id))
            .orderBy(asc(clientTable.name));

        // Format response
        const formattedClients = rows.map((row) => ({
            clientId: row.clientId,
            clientName: row.clientName,
            companyName: row.companyName,
            isConnected: !!row.channelPk,
            channel: row.channelPk
                ? {
                    id: row.channelId,
                    title: row.channelTitle,
                    avatar: row.channelAvatar,
                    subscribers: row.subscriberCount,
                    totalViews: row.totalViews,
                    totalVideos: row.totalVideos,
                    lastSyncedAt: row.lastSyncedAt,
                    syncStatus: row.syncStatus,
                    isActive: row.isActive,
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
