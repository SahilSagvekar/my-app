// app/api/admin/reports/performance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken, requireAdmin } from '@/lib/auth-helpers';
import { TaskStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    const authError = requireAdmin(currentUser);
    
    if (authError) {
      return NextResponse.json(
        { ok: false, message: authError.error },
        { status: authError.status }
      );
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Build date filter
    let dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = {
        gte: thirtyDaysAgo
      };
    }

    // Get all active employees
    const employees = await prisma.user.findMany({
      where: {
        role: { not: 'client' },
        employeeStatus: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        role: true
      }
    });

    const performanceData = await Promise.all(
      employees.map(async (employee) => {
        // Get total tasks for this employee
        const totalTasks = await prisma.task.count({
          where: {
            OR: [
              { assignedTo: employee.id },
              { createdBy: employee.id },
              { qc_specialist: employee.id },
              { scheduler: employee.id }
            ],
            createdAt: dateFilter
          }
        });

        // Get completed tasks
        const completedTasks = await prisma.task.count({
          where: {
            assignedTo: employee.id,
            status: TaskStatus.COMPLETED,
            updatedAt: dateFilter
          }
        });

        // Calculate working days in period
        const start = new Date(dateFilter.gte);
        const end = dateFilter.lte ? new Date(dateFilter.lte) : new Date();
        const workingDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate daily average
        const avgDaily = workingDays > 0 ? totalTasks / workingDays : 0;

        // Calculate efficiency (completed / assigned * 100)
        const assignedTasks = await prisma.task.count({
          where: {
            assignedTo: employee.id,
            createdAt: dateFilter
          }
        });

        const efficiency = assignedTasks > 0 
          ? Math.round((completedTasks / assignedTasks) * 100)
          : 0;

        // Calculate trend (compare with previous period)
        const previousPeriodStart = new Date(start);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - workingDays);
        
        const previousTasks = await prisma.task.count({
          where: {
            OR: [
              { assignedTo: employee.id },
              { createdBy: employee.id }
            ],
            createdAt: {
              gte: previousPeriodStart,
              lt: start
            }
          }
        });

        let trend: 'up' | 'down' | 'stable' = 'stable';
        if (totalTasks > previousTasks * 1.1) trend = 'up';
        else if (totalTasks < previousTasks * 0.9) trend = 'down';

        return {
          employee: employee.name,
          role: employee.role,
          totalTasks,
          avgDaily: parseFloat(avgDaily.toFixed(1)),
          efficiency: Math.min(efficiency, 100),
          trend
        };
      })
    );

    // Sort by total tasks descending
    performanceData.sort((a, b) => b.totalTasks - a.totalTasks);

    return NextResponse.json({
      ok: true,
      performance: performanceData
    });

  } catch (error) {
    console.error('Error fetching performance data:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}