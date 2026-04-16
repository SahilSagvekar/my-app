export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';

export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);

    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch all active clients with their monthly deliverables
    const clients = await prisma.client.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        companyName: true,
        monthlyDeliverables: {
          select: {
            id: true,
            type: true,
            quantity: true,
            platforms: true,
            postingDays: true,
            videosPerDay: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Get current month's days
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Process deliverables and calculate daily targets
    const dailyTargets = clients
      .filter(client => client.monthlyDeliverables.length > 0)
      .map(client => {
        const deliverables = client.monthlyDeliverables.map(d => {
          // Calculate posts per day
          // If postingDays is specified, use those days count, otherwise use full month
          const activeDays = d.postingDays && d.postingDays.length > 0 
            ? Math.ceil((d.postingDays.length / 7) * daysInMonth)
            : daysInMonth;
          
          const postsPerDay = d.quantity / activeDays;

          return {
            id: d.id,
            type: d.type,
            monthlyQuantity: d.quantity,
            platforms: d.platforms || [],
            postingDays: d.postingDays || [],
            videosPerDay: d.videosPerDay,
            postsPerDay: Math.round(postsPerDay * 100) / 100, // Round to 2 decimals
            activeDaysPerMonth: activeDays,
          };
        });

        // Calculate totals for this client
        const totalMonthly = deliverables.reduce((sum, d) => sum + d.monthlyQuantity, 0);
        const totalPerDay = deliverables.reduce((sum, d) => sum + d.postsPerDay, 0);

        return {
          clientId: client.id,
          clientName: client.companyName || client.name,
          deliverables,
          totalMonthly,
          totalPerDay: Math.round(totalPerDay * 100) / 100,
        };
      })
      .filter(client => client.deliverables.length > 0)
      .sort((a, b) => b.totalPerDay - a.totalPerDay); // Sort by highest daily target first

    // Calculate grand totals
    const grandTotalMonthly = dailyTargets.reduce((sum, c) => sum + c.totalMonthly, 0);
    const grandTotalPerDay = dailyTargets.reduce((sum, c) => sum + c.totalPerDay, 0);

    return NextResponse.json({
      ok: true,
      daysInMonth,
      currentMonth: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      totalClients: dailyTargets.length,
      grandTotalMonthly,
      grandTotalPerDay: Math.round(grandTotalPerDay * 100) / 100,
      clients: dailyTargets,
    });

  } catch (error) {
    console.error('Error fetching daily targets:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}