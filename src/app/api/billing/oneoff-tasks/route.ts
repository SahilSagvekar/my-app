export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { task } from '@/lib/db/schema';
import { and, eq, isNotNull, inArray, asc } from 'drizzle-orm';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

// GET - Fetch unbilled one-off tasks for a client (grouped by deliverable type)
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    if (authError) {
      return NextResponse.json({ ok: false, message: authError.error }, { status: authError.status });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ ok: false, message: 'clientId is required' }, { status: 400 });
    }

    // Fetch tasks that are SCHEDULED or POSTED and belong to a one-off deliverable
    // Note: Once you add billedAt to schema, add: billedAt: null to the where clause
    const unbilledTasks = await db.query.task.findMany({
      where: and(
        eq(task.clientId, clientId),
        isNotNull(task.oneOffDeliverableId),
        inArray(task.status, ['SCHEDULED', 'POSTED'] as any),
        // billedAt: null, // Uncomment after adding billedAt to Task model
      ),
      with: {
        oneOffDeliverable: {
          columns: {
            id: true,
            type: true,
            platforms: true,
          },
        },
      },
      orderBy: asc(task.createdAt),
    });

    console.log(`Fetched ${unbilledTasks.length} one-off tasks for client ${clientId}`);

    // Group tasks by deliverable type
    const groupedByType: Record<string, {
      type: string;
      tasks: Array<{
        id: string;
        title: string | null;
        status: string | null;
        deliverableType: string | null;
        socialMediaLinks: any;
        createdAt: string;
        oneOffDeliverableId: string | null;
      }>;
      totalCount: number;
      platforms: string[];
    }> = {};

    unbilledTasks.forEach((task) => {
      // Use deliverableType from task, or fallback to oneOffDeliverable.type
      const type = task.deliverableType || task.oneOffDeliverable?.type || 'Unknown';
      
      if (!groupedByType[type]) {
        groupedByType[type] = {
          type,
          tasks: [],
          totalCount: 0,
          platforms: task.oneOffDeliverable?.platforms || [],
        };
      }

      groupedByType[type].tasks.push({
        id: task.id,
        title: task.title,
        status: task.status,
        deliverableType: task.deliverableType,
        socialMediaLinks: task.socialMediaLinks,
        createdAt: task.createdAt,
        oneOffDeliverableId: task.oneOffDeliverableId,
      });
      groupedByType[type].totalCount++;
    });

    // Convert to array
    const typeGroups = Object.values(groupedByType);

    return NextResponse.json({
      ok: true,
      typeGroups,
      totalUnbilledTasks: unbilledTasks.length,
    });
  } catch (error: any) {
    console.error('Error fetching unbilled one-off tasks:', error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
}