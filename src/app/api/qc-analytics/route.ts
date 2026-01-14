

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import "@/lib/bigint-fix";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// Helper to get date ranges
function getDateRange(period: 'week' | 'month' | 'year' = 'month') {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case 'week':
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'year':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  return { startDate, endDate: now };
}

// Calculate average review time in minutes
async function getAverageReviewTime(qcSpecialistId: number, period: 'week' | 'month' | 'year' = 'month') {
  const { startDate, endDate } = getDateRange(period);

  const completedTasks = await prisma.task.findMany({
    where: {
      qc_specialist: qcSpecialistId,
      status: {
        in: [TaskStatus.COMPLETED, TaskStatus.REJECTED],
      },
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
  });

  if (completedTasks.length === 0) return 0;

  const totalTime = completedTasks.reduce((acc, task) => {
    const timeDiff = new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime();
    return acc + timeDiff;
  }, 0);

  const avgTimeMs = totalTime / completedTasks.length;
  return Math.round(avgTimeMs / (1000 * 60)); // Convert to minutes
}

// Get approval rate
async function getApprovalRate(qcSpecialistId: number, period: 'week' | 'month' | 'year' = 'month') {
  const { startDate, endDate } = getDateRange(period);

  const totalReviews = await prisma.task.count({
    where: {
      qc_specialist: qcSpecialistId,
      status: {
        in: [TaskStatus.COMPLETED, TaskStatus.REJECTED],
      },
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  if (totalReviews === 0) return 0;

  const approvedCount = await prisma.task.count({
    where: {
      qc_specialist: qcSpecialistId,
      status: TaskStatus.COMPLETED,
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return parseFloat(((approvedCount / totalReviews) * 100).toFixed(1));
}

// Get first-pass rate (approved without rejection)
async function getFirstPassRate(qcSpecialistId: number, period: 'week' | 'month' | 'year' = 'month') {
  const { startDate, endDate } = getDateRange(period);

  const totalReviews = await prisma.task.count({
    where: {
      qc_specialist: qcSpecialistId,
      status: {
        in: [TaskStatus.COMPLETED, TaskStatus.REJECTED],
      },
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  if (totalReviews === 0) return 0;

  const firstPassCount = await prisma.task.count({
    where: {
      qc_specialist: qcSpecialistId,
      status: TaskStatus.COMPLETED,
      qcNotes: null,
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return parseFloat(((firstPassCount / totalReviews) * 100).toFixed(1));
}

// Get review breakdown by category
async function getReviewsByCategory(qcSpecialistId: number, period: 'week' | 'month' | 'year' = 'month') {
  const { startDate, endDate } = getDateRange(period);

  const categories = ['video', 'design', 'copywriting'];
  const results = [];

  for (const category of categories) {
    const totalReviews = await prisma.task.count({
      where: {
        qc_specialist: qcSpecialistId,
        taskCategory: category,
        status: {
          in: [TaskStatus.COMPLETED, TaskStatus.REJECTED],
        },
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const approvedCount = await prisma.task.count({
      where: {
        qc_specialist: qcSpecialistId,
        taskCategory: category,
        status: TaskStatus.COMPLETED,
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const approvalRate = totalReviews > 0 
      ? parseFloat(((approvedCount / totalReviews) * 100).toFixed(1))
      : 0;

    results.push({
      category: category.charAt(0).toUpperCase() + category.slice(1),
      reviews: totalReviews,
      approvalRate,
      status: approvalRate >= 85 ? 'Excellent' : approvalRate >= 75 ? 'Good' : 'Needs Improvement',
    });
  }

  return results;
}

// Extract and track rejection reasons
async function updateRejectionReasons(qcSpecialistId: number) {
  const rejectedTasks = await prisma.task.findMany({
    where: {
      qc_specialist: qcSpecialistId,
      status: TaskStatus.REJECTED,
      qcNotes: {
        not: null,
      },
    },
    select: {
      id: true,
      qcNotes: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 100,
  });

  // Keywords to track
  const keywords: Record<string, string[]> = {
    'Brand color': ['brand color', 'color mismatch', 'color match'],
    'Typography': ['typography', 'font', 'text size', 'font size'],
    'Audio quality': ['audio', 'sound', 'music', 'voice-over', 'volume'],
    'Grid alignment': ['grid', 'alignment', 'align', 'spacing'],
    'Missing elements': ['missing', 'incomplete', 'required'],
    'Aspect ratio': ['aspect ratio', 'resolution', 'dimensions'],
    'Contrast': ['contrast', 'visibility', 'clarity'],
  };

  for (const [reasonName, keywordsList] of Object.entries(keywords)) {
    let matchCount = 0;
    let matchedTaskIds: string[] = [];

    rejectedTasks.forEach((task) => {
      if (task.qcNotes) {
        const hasKeyword = keywordsList.some((kw) =>
          task.qcNotes?.toLowerCase().includes(kw.toLowerCase())
        );
        if (hasKeyword) {
          matchCount++;
          matchedTaskIds.push(task.id);
        }
      }
    });

    if (matchCount > 0) {
      // Update or create rejection reason
      await prisma.qCRejectionReason.upsert({
        where: {
          qcSpecialistId_reason: {
            qcSpecialistId,
            reason: reasonName,
          },
        },
        create: {
          qcSpecialistId,
          reason: reasonName,
          caseCount: matchCount,
          taskIds: matchedTaskIds,
        },
        update: {
          caseCount: matchCount,
          taskIds: matchedTaskIds,
          lastOccurrence: new Date(),
        },
      });
    }
  }
}

// Get top rejection reasons
async function getTopRejectionReasons(qcSpecialistId: number, limit: number = 5) {
  const reasons = await prisma.qCRejectionReason.findMany({
    where: {
      qcSpecialistId,
    },
    orderBy: {
      caseCount: 'desc',
    },
    take: limit,
  });

  return reasons.map((r: any) => ({
    reason: r.reason,
    cases: r.caseCount,
  }));
}

// Get or create monthly trend
async function updateMonthlyTrend(qcSpecialistId: number, year: number, month: number) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const totalReviews = await prisma.task.count({
    where: {
      qc_specialist: qcSpecialistId,
      status: {
        in: [TaskStatus.COMPLETED, TaskStatus.REJECTED],
      },
      updatedAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });

  const approvedCount = await prisma.task.count({
    where: {
      qc_specialist: qcSpecialistId,
      status: TaskStatus.COMPLETED,
      updatedAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });

  const rejectedCount = totalReviews - approvedCount;
  const avgTime = await getAverageReviewTime(qcSpecialistId, 'month');
  const approvalRate = totalReviews > 0 
    ? parseFloat(((approvedCount / totalReviews) * 100).toFixed(1))
    : 0;

  await prisma.qCMonthlyTrend.upsert({
    where: {
      qcSpecialistId_year_month: {
        qcSpecialistId,
        year,
        month,
      },
    },
    create: {
      qcSpecialistId,
      year,
      month,
      reviewCount: totalReviews,
      approvedCount,
      rejectedCount,
      avgReviewTime: new Decimal(avgTime.toString()),
      approvalRate: new Decimal(approvalRate.toString()),
    },
    update: {
      reviewCount: totalReviews,
      approvedCount,
      rejectedCount,
      avgReviewTime: new Decimal(avgTime.toString()),
      approvalRate: new Decimal(approvalRate.toString()),
    },
  });
}

// Get monthly trends
async function getMonthlyTrend(qcSpecialistId: number, months: number = 6) {
  const trends = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const trend = await prisma.qCMonthlyTrend.findUnique({
      where: {
        qcSpecialistId_year_month: {
          qcSpecialistId,
          year,
          month,
        },
      },
    });

    const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    trends.push({
      month: monthName,
      reviews: trend?.reviewCount || 0,
    });
  }

  return trends;
}

// Update category metrics
async function updateCategoryMetrics(qcSpecialistId: number, period: 'week' | 'month' | 'year' = 'month') {
  const { startDate, endDate } = getDateRange(period);
  const categories = ['video', 'design', 'copywriting'];

  for (const category of categories) {
    const totalReviews = await prisma.task.count({
      where: {
        qc_specialist: qcSpecialistId,
        taskCategory: category,
        status: {
          in: [TaskStatus.COMPLETED, TaskStatus.REJECTED],
        },
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const approvedCount = await prisma.task.count({
      where: {
        qc_specialist: qcSpecialistId,
        taskCategory: category,
        status: TaskStatus.COMPLETED,
        updatedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const rejectedCount = totalReviews - approvedCount;
    const approvalRate = totalReviews > 0 
      ? parseFloat(((approvedCount / totalReviews) * 100).toFixed(1))
      : 0;
    const avgTime = await getAverageReviewTime(qcSpecialistId, period);

    if (totalReviews > 0) {
      await prisma.qCCategoryMetrics.upsert({
        where: {
          qcSpecialistId_category_period_startDate: {
            qcSpecialistId,
            category,
            period,
            startDate,
          },
        },
        create: {
          qcSpecialistId,
          category,
          reviewCount: totalReviews,
          approvedCount,
          rejectedCount,
          approvalRate: new Decimal(approvalRate.toString()),
          avgReviewTime: new Decimal(avgTime.toString()),
          period,
          startDate,
          endDate,
        },
        update: {
          reviewCount: totalReviews,
          approvedCount,
          rejectedCount,
          approvalRate: new Decimal(approvalRate.toString()),
          avgReviewTime: new Decimal(avgTime.toString()),
          endDate,
        },
      });
    }
  }
}

// Check and award achievements
async function updateAchievements(qcSpecialistId: number) {
  const approvalRate = await getApprovalRate(qcSpecialistId, 'month');
  const { startDate, endDate } = getDateRange('week');

  const thisWeekReviews = await prisma.task.count({
    where: {
      qc_specialist: qcSpecialistId,
      status: {
        in: [TaskStatus.COMPLETED, TaskStatus.REJECTED],
      },
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Quality Champion: 90%+ approval rate for 30 days
  if (approvalRate >= 90) {
    await prisma.qCAchievement.upsert({
      where: {
        qcSpecialistId_achievementType: {
          qcSpecialistId,
          achievementType: 'QUALITY_CHAMPION',
        },
      },
      create: {
        qcSpecialistId,
        achievementType: 'QUALITY_CHAMPION',
        achievementData: { approvalRate },
      },
      update: {
        achievementData: { approvalRate },
      },
    });
  } else {
    // Remove if no longer qualified
    await prisma.qCAchievement.deleteMany({
      where: {
        qcSpecialistId,
        achievementType: 'QUALITY_CHAMPION',
      },
    });
  }

  // Speed Reviewer: 50+ reviews in a week
  if (thisWeekReviews >= 50) {
    await prisma.qCAchievement.upsert({
      where: {
        qcSpecialistId_achievementType: {
          qcSpecialistId,
          achievementType: 'SPEED_REVIEWER',
        },
      },
      create: {
        qcSpecialistId,
        achievementType: 'SPEED_REVIEWER',
        achievementData: { reviewCount: thisWeekReviews },
      },
      update: {
        achievementData: { reviewCount: thisWeekReviews },
      },
    });
  } else {
    // Remove if no longer qualified
    await prisma.qCAchievement.deleteMany({
      where: {
        qcSpecialistId,
        achievementType: 'SPEED_REVIEWER',
      },
    });
  }
}

// Get weekly breakdown
async function getWeeklyBreakdown(qcSpecialistId: number) {
  const { startDate, endDate } = getDateRange('week');

  const approvedCount = await prisma.task.count({
    where: {
      qc_specialist: qcSpecialistId,
      status: TaskStatus.COMPLETED,
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const rejectedCount = await prisma.task.count({
    where: {
      qc_specialist: qcSpecialistId,
      status: TaskStatus.REJECTED,
      updatedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const totalTasks = approvedCount + rejectedCount;

  const avgTime = totalTasks > 0 
    ? await getAverageReviewTime(qcSpecialistId, 'week')
    : 0;

  const firstPassRate = await getFirstPassRate(qcSpecialistId, 'week');

  return {
    approved: approvedCount,
    rejected: rejectedCount,
    avgTime,
    firstPassRate,
  };
}

export async function GET(req: Request) {
  try {
    // 🔒 AUTH
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    // Only QC and admin/manager can access analytics
    if (!['qc', 'admin', 'manager'].includes(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || 'month') as 'week' | 'month' | 'year';
    const qcSpecialistId = role === 'qc' ? userId : parseInt(searchParams.get('qcId') || '0');

    if (!qcSpecialistId) {
      return NextResponse.json(
        { message: "QC Specialist ID is required for admin/manager" },
        { status: 400 }
      );
    }

    // 📊 UPDATE ALL ANALYTICS DATA IN DATABASE
    const now = new Date();
    
    // Update rejection reasons
    await updateRejectionReasons(qcSpecialistId);

    // Update monthly trend for current month
    await updateMonthlyTrend(qcSpecialistId, now.getFullYear(), now.getMonth() + 1);

    // Update category metrics
    await updateCategoryMetrics(qcSpecialistId, period);

    // Update achievements
    await updateAchievements(qcSpecialistId);

    // 📊 FETCH ALL ANALYTICS DATA
    const [
      avgReviewTime,
      approvalRate,
      firstPassRate,
      reviewsByCategory,
      topRejectionReasons,
      monthlyTrend,
      weeklyBreakdown,
    ] = await Promise.all([
      getAverageReviewTime(qcSpecialistId, period),
      getApprovalRate(qcSpecialistId, period),
      getFirstPassRate(qcSpecialistId, period),
      getReviewsByCategory(qcSpecialistId, period),
      getTopRejectionReasons(qcSpecialistId),
      getMonthlyTrend(qcSpecialistId),
      getWeeklyBreakdown(qcSpecialistId),
    ]);

    // Get achievements
    const achievements = await prisma.qCAchievement.findMany({
      where: { qcSpecialistId },
    });

    const analytics = {
      period,
      qcSpecialistId,
      performanceMetrics: {
        avgReviewTime,
        approvalRate,
        firstPassRate,
        thisWeekReviews: weeklyBreakdown.approved + weeklyBreakdown.rejected,
      },
      reviewsByCategory,
      topRejectionReasons,
      monthlyTrend,
      weeklyBreakdown,
      achievements: {
        qualityChampion: achievements.some((a: any) => a.achievementType === 'QUALITY_CHAMPION'),
        speedReviewer: achievements.some((a: any) => a.achievementType === 'SPEED_REVIEWER'),
      },
    };

    return NextResponse.json(analytics, { status: 200 });
  } catch (err: any) {
    console.error("❌ Analytics error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}