// app/api/admin/activity-records/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { startOfDay, endOfDay, parseISO } from 'date-fns';

function getTokenFromCookies(req: NextRequest) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

export async function GET(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (decoded.role !== 'admin') {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const url = new URL(req.url);
        const dateStr = url.searchParams.get('date');
        const role = url.searchParams.get('role');
        const search = url.searchParams.get('search');

        const targetDate = dateStr ? parseISO(dateStr) : new Date();

        // Activity Records are specifically for non-admin/non-client
        const activityLogs = await prisma.auditLog.findMany({
            where: {
                timestamp: {
                    gte: startOfDay(targetDate),
                    lte: endOfDay(targetDate),
                },
                User: {
                    role: {
                        notIn: ['admin', 'client'],
                        ...(role && role !== 'all' ? { equals: role as any } : {})
                    },
                    ...(search ? {
                        name: { contains: search, mode: 'insensitive' }
                    } : {})
                }
            },
            include: {
                User: {
                    select: {
                        name: true,
                        role: true,
                        email: true
                    }
                }
            },
            orderBy: { timestamp: 'desc' }
        });

        // Format logs for the UI
        const formattedLogs = activityLogs.map(log => {
            let actionType = 'update';
            if (log.action.includes('CREATED')) actionType = 'creation';
            else if (log.action.includes('UPDATED')) actionType = 'update';
            else if (log.action.includes('DELETED')) actionType = 'deletion';
            else if (log.action.includes('APPROVED')) actionType = 'approval';
            else if (log.action.includes('REJECTED')) actionType = 'rejection';
            else if (log.action.includes('LOGIN') || log.action.includes('LOGOUT')) actionType = 'security';
            else if (log.action.includes('RESET_2FA')) actionType = 'security';

            return {
                ...log,
                actionType,
                description: log.details || log.action,
                user: log.User?.name || 'Unknown',
                target: log.entity ? `${log.entity} #${log.entityId}` : 'N/A'
            };
        });

        // Compute some stats for the explorer
        const stats = {
            totalActions: activityLogs.length,
            uniqueEmployees: new Set(activityLogs.map(l => l.userId)).size,
            topAction: activityLogs.length > 0 ?
                Object.entries(activityLogs.reduce((acc: any, log) => {
                    acc[log.action] = (acc[log.action] || 0) + 1;
                    return acc;
                }, {})).sort((a: any, b: any) => b[1] - a[1])[0][0] : 'N/A'
        };

        return NextResponse.json({ logs: formattedLogs, stats });
    } catch (error: any) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
