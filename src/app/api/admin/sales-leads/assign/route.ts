export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getVisibleSalesRepIds } from '@/lib/salesManagerPermissions';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// PATCH /api/admin/sales-leads/assign
// Body:
//   { leadIds: string[], targetUserId: number }        → assign all leads to one person
//   { leadIds: string[], distributeToAll: true }       → round-robin across all active sales users
//
// admin: unrestricted. sales_manager: leadIds must currently belong to a rep they're
// permitted to see, and targetUserId (or round-robin pool) is limited to permitted reps.
export async function PATCH(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!decoded?.userId || (decoded.role !== 'admin' && decoded.role !== 'sales_manager')) {
      return NextResponse.json({ ok: false, message: 'Forbidden — admin only' }, { status: 403 });
    }

    const isManager = decoded.role === 'sales_manager';
    const visibleRepIds = isManager ? await getVisibleSalesRepIds(Number(decoded.userId)) : null;

    const body = await req.json();
    const { leadIds, targetUserId, distributeToAll } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json({ ok: false, message: 'leadIds array is required' }, { status: 400 });
    }

    if (!targetUserId && !distributeToAll) {
      return NextResponse.json({ ok: false, message: 'Provide targetUserId or distributeToAll: true' }, { status: 400 });
    }

    if (isManager) {
      const owned = await prisma.salesLead.count({
        where: { id: { in: leadIds }, userId: { in: visibleRepIds! } },
      });
      if (owned !== leadIds.length) {
        return NextResponse.json({ ok: false, message: 'Some leads are outside your permitted reps' }, { status: 403 });
      }
    }

    // Distribute round-robin across all active sales users
    if (distributeToAll) {
      const salesUsers = await prisma.user.findMany({
        where: isManager ? { role: 'sales', id: { in: visibleRepIds! } } : { role: 'sales' },
        select: { id: true },
        orderBy: { id: 'asc' },
      });

      if (salesUsers.length === 0) {
        return NextResponse.json({ ok: false, message: 'No sales users found' }, { status: 404 });
      }

      // Round-robin assignment
      const updates = leadIds.map((leadId, i) => {
        const assignee = salesUsers[i % salesUsers.length];
        return prisma.salesLead.update({
          where: { id: leadId },
          data: { userId: assignee.id },
        });
      });

      await prisma.$transaction(updates);

      return NextResponse.json({
        ok: true,
        message: `${leadIds.length} lead${leadIds.length !== 1 ? 's' : ''} distributed across ${salesUsers.length} sales rep${salesUsers.length !== 1 ? 's' : ''}`,
        assigned: leadIds.length,
      });
    }

    // Assign all to one person
    if (isManager && !visibleRepIds!.includes(Number(targetUserId))) {
      return NextResponse.json({ ok: false, message: 'Target user is outside your permitted reps' }, { status: 403 });
    }

    const targetUser: any = await (prisma as any).user.findUnique({
      where: { id: Number(targetUserId) },
      select: { id: true, name: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ ok: false, message: 'Target user not found' }, { status: 404 });
    }

    if (targetUser.role !== 'sales' && targetUser.role !== 'sales_manager') {
      return NextResponse.json({ ok: false, message: 'Target user is not a sales rep' }, { status: 400 });
    }

    await prisma.salesLead.updateMany({
      where: { id: { in: leadIds } },
      data: { userId: Number(targetUserId) },
    });

    return NextResponse.json({
      ok: true,
      message: `${leadIds.length} lead${leadIds.length !== 1 ? 's' : ''} assigned to ${targetUser.name || targetUser.id}`,
      assigned: leadIds.length,
    });

  } catch (err) {
    console.error('[PATCH /api/admin/sales-leads/assign]', err);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}