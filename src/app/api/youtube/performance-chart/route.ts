// app/api/youtube/performance-chart/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const metric = searchParams.get('metric') || 'views';
        const period = parseInt(searchParams.get('period') || '28');
        let clientId = searchParams.get('clientId');

        // If user is a client, they can only see their own data
        if (user.role === 'client') {
            const client = await prisma.client.findUnique({
                where: { userId: user.id },
                select: { id: true },
            });

            if (!client) {
                return NextResponse.json(
                    { error: 'Client profile not found' },
                    { status: 404 }
                );
            }

            clientId = client.id;
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

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - period);

        // Fetch snapshots for the period
        const snapshots = await prisma.youTubeSnapshot.findMany({
            where: {
                clientId,
                periodStart: { gte: startDate },
                periodType: 'DAILY',
            },
            orderBy: { periodStart: 'asc' },
            select: {
                periodStart: true,
                views: true,
                watchTimeHours: true,
                estimatedRevenue: true,
                subscriberCount: true,
            },
        });

        // Format data for chart
        const chartData = snapshots.map((snapshot) => {
            let value = 0;

            switch (metric) {
                case 'views':
                    value = Number(snapshot.views);
                    break;
                case 'watchTime':
                    value = snapshot.watchTimeHours;
                    break;
                case 'revenue':
                    value = snapshot.estimatedRevenue || 0;
                    break;
                case 'subscribers':
                    value = snapshot.subscriberCount;
                    break;
                default:
                    value = Number(snapshot.views);
            }

            return {
                date: snapshot.periodStart.toISOString().split('T')[0],
                value,
            };
        });

        return NextResponse.json({
            success: true,
            data: chartData,
            metric,
            period,
        });
    } catch (error: any) {
        console.error('[YouTube Performance Chart] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch chart data' },
            { status: 500 }
        );
    }
}
