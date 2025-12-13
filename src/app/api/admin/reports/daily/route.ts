// app/api/admin/reports/daily/route.ts
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
    const employeeId = url.searchParams.get('employeeId');
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
      // Default to last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      dateFilter = {
        gte: thirtyDaysAgo
      };
    }

    // Build employee filter
    let employeeFilter: any = {
      role: { not: 'client' }
    };
    
    if (employeeId && employeeId !== 'all') {
      employeeFilter.id = parseInt(employeeId);
    }

    // Get all employees matching filter
    const employees = await prisma.user.findMany({
      where: employeeFilter,
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });

    // Get daily task activity for each employee
    const dailyReports = await Promise.all(
      employees.map(async (employee) => {
        // Get tasks created by this employee (uploaded)
        const tasksCreated = await prisma.task.groupBy({
          by: ['createdAt'],
          where: {
            createdBy: employee.id,
            createdAt: dateFilter
          },
          _count: {
            id: true
          }
        });

        // Get tasks completed/approved by this employee
        const tasksCompleted = await prisma.task.groupBy({
          by: ['updatedAt'],
          where: {
            assignedTo: employee.id,
            status: TaskStatus.COMPLETED,
            updatedAt: dateFilter
          },
          _count: {
            id: true
          }
        });

        // Get QC tasks (for QC specialists)
        const qcTasks = employee.role === 'qc' ? await prisma.task.groupBy({
          by: ['updatedAt'],
          where: {
            qc_specialist: employee.id,
            status: {
              in: [TaskStatus.QC_IN_PROGRESS, TaskStatus.READY_FOR_QC]
            },
            updatedAt: dateFilter
          },
          _count: {
            id: true
          }
        }) : [];

        // Get scheduled tasks (for schedulers)
        const scheduledTasks = employee.role === 'scheduler' ? await prisma.task.groupBy({
          by: ['updatedAt'],
          where: {
            scheduler: employee.id,
            status: TaskStatus.SCHEDULED,
            updatedAt: dateFilter
          },
          _count: {
            id: true
          }
        }) : [];

        // Aggregate by date
        const dailyData = new Map();

        // Process created tasks
        tasksCreated.forEach(item => {
          const date = new Date(item.createdAt).toISOString().split('T')[0];
          if (!dailyData.has(date)) {
            dailyData.set(date, {
              date,
              employee: employee.name,
              role: employee.role,
              tasksUploaded: 0,
              tasksApproved: 0,
              qcChecks: 0,
              schedulingTasks: 0,
              totalOutput: 0
            });
          }
          dailyData.get(date).tasksUploaded += item._count.id;
        });

        // Process completed tasks
        tasksCompleted.forEach(item => {
          const date = new Date(item.updatedAt).toISOString().split('T')[0];
          if (!dailyData.has(date)) {
            dailyData.set(date, {
              date,
              employee: employee.name,
              role: employee.role,
              tasksUploaded: 0,
              tasksApproved: 0,
              qcChecks: 0,
              schedulingTasks: 0,
              totalOutput: 0
            });
          }
          dailyData.get(date).tasksApproved += item._count.id;
        });

        // Process QC tasks
        qcTasks.forEach(item => {
          const date = new Date(item.updatedAt).toISOString().split('T')[0];
          if (!dailyData.has(date)) {
            dailyData.set(date, {
              date,
              employee: employee.name,
              role: employee.role,
              tasksUploaded: 0,
              tasksApproved: 0,
              qcChecks: 0,
              schedulingTasks: 0,
              totalOutput: 0
            });
          }
          dailyData.get(date).qcChecks += item._count.id;
        });

        // Process scheduled tasks
        scheduledTasks.forEach(item => {
          const date = new Date(item.updatedAt).toISOString().split('T')[0];
          if (!dailyData.has(date)) {
            dailyData.set(date, {
              date,
              employee: employee.name,
              role: employee.role,
              tasksUploaded: 0,
              tasksApproved: 0,
              qcChecks: 0,
              schedulingTasks: 0,
              totalOutput: 0
            });
          }
          dailyData.get(date).schedulingTasks += item._count.id;
        });

        // Calculate total output for each day
        dailyData.forEach(day => {
          day.totalOutput = day.tasksUploaded + day.tasksApproved + day.qcChecks + day.schedulingTasks;
        });

        return Array.from(dailyData.values());
      })
    );

    // Flatten and sort by date
    const allReports = dailyReports
      .flat()
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      ok: true,
      reports: allReports,
      total: allReports.length
    });

  } catch (error) {
    console.error('Error fetching daily reports:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}