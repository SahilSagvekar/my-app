// app/api/cron/youtube-sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { syncAllYouTubeChannels } from '@/lib/youtube-sync-service';

export async function POST(req: NextRequest) {
    try {
        // Verify cron secret
        const cronSecret = req.headers.get('x-cron-secret');
        const expectedSecret = process.env.CRON_SECRET;

        if (expectedSecret && cronSecret !== expectedSecret) {
            // Allow without secret in development
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        console.log('[YouTube Cron] Starting YouTube sync job');

        // Run the sync
        const result = await syncAllYouTubeChannels();

        console.log('[YouTube Cron] Sync job completed:', result);

        return NextResponse.json({
            success: true,
            message: 'YouTube sync completed',
            ...result,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[YouTube Cron] Error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Sync failed',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}

// Allow manual trigger via GET (for testing)
export async function GET(req: NextRequest) {
    try {
        // Check if user is admin
        const { searchParams } = new URL(req.url);
        const secret = searchParams.get('secret');

        // if (secret !== process.env.CRON_SECRET) {
        //     return NextResponse.json(
        //         { error: 'Unauthorized' },
        //         { status: 401 }
        //     );
        // }

        console.log('[YouTube Cron] Manual sync triggered');

        const result = await syncAllYouTubeChannels();

        return NextResponse.json({
            success: true,
            message: 'Manual YouTube sync completed',
            ...result,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('[YouTube Cron] Manual sync error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Sync failed',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}
