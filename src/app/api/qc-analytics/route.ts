export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import "@/lib/bigint-fix";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { cached } from "@/lib/redis";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

type Period = "week" | "month" | "year";

interface DateRange {
  startDate: Date;
  endDate: Date;
}

// Helper to get date ranges
function getDateRange(period: Period = "month"): DateRange {
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case "week":
      startDate.setDate(now.getDate() - 7);
      break;
    case "month":
      startDate.setMonth(now.getMonth() - 1);
      break;
    case "year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
  }

  return { startDate, endDate: now };
}

// ============================================================================
// ANALYTICS DATA INTERFACES
// ============================================================================

interface AnalyticsData {
  period: Period;
  qcSpecialistId: number;
  performanceMetrics: {
    avgReviewTime: number;
    approvalRate: number;
    firstPassRate: number;
    thisWeekReviews: number;
  };
  reviewsByCategory: Array<{
    category: string;
    reviews: number;
    approvalRate: number;
    status: string;
  }>;
  topRejectionReasons: Array<{
    reason: string;
    cases: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    reviews: number;
  }>;
  weeklyBreakdown: {
    approved: number;
    rejected: number;
    avgTime: number;
    firstPassRate: number;
  };
  achievements: {
    qualityChampion: boolean;
    speedReviewer: boolean;
  };
}

// ============================================================================
// BATCHED ANALYTICS FETCHER
// ============================================================================

async function getAnalytics(
  qcSpecialistId: number,
  period: Period
): Promise<AnalyticsData> {
  const { startDate, endDate } = getDateRange(period);
  const weekRange = getDateRange("week");

  // -------------------------------------------------------------------------
  // BATCH 1: Get all task stats grouped by status and category
  // -------------------------------------------------------------------------
  const taskStatsByStatusAndCategory = await prisma.task.groupBy({
    by: ["status", "taskCategory"],
    where: {
      qc_specialist: qcSpecialistId,
      status: { in: [TaskStatus.COMPLETED, TaskStatus.REJECTED] },
      updatedAt: { gte: startDate, lte: endDate },
    },
    _count: {
      _all: true,
    },
  });

  // -------------------------------------------------------------------------
  // BATCH 2: Get weekly stats separately (different date range)
  // -------------------------------------------------------------------------
  const weeklyStats = await prisma.task.groupBy({
    by: ["status"],
    where: {
      qc_specialist: qcSpecialistId,
      status: { in: [TaskStatus.COMPLETED, TaskStatus.REJECTED] },
      updatedAt: { gte: weekRange.startDate, lte: weekRange.endDate },
    },
    _count: {
      _all: true,
    },
  });

  // -------------------------------------------------------------------------
  // BATCH 3: Get first-pass count (approved without QC notes = no revisions)
  // -------------------------------------------------------------------------
  const [firstPassCount, weeklyFirstPassCount] = await Promise.all([
    prisma.task.count({
      where: {
        qc_specialist: qcSpecialistId,
        status: TaskStatus.COMPLETED,
        qcNotes: null, // No QC notes means approved on first pass
        updatedAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.task.count({
      where: {
        qc_specialist: qcSpecialistId,
        status: TaskStatus.COMPLETED,
        qcNotes: null,
        updatedAt: { gte: weekRange.startDate, lte: weekRange.endDate },
      },
    }),
  ]);

  // -------------------------------------------------------------------------
  // BATCH 4: Get sample of completed tasks for average review time calculation
  // NOTE: This calculates total task lifetime (createdAt to updatedAt).
  // For accurate QC review time, consider adding qcStartedAt field to Task.
  // -------------------------------------------------------------------------
  const recentCompletedTasks = await prisma.task.findMany({
    where: {
      qc_specialist: qcSpecialistId,
      status: { in: [TaskStatus.COMPLETED, TaskStatus.REJECTED] },
      updatedAt: { gte: startDate, lte: endDate },
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
    take: 100, // Sample for performance
    orderBy: { updatedAt: "desc" },
  });

  // -------------------------------------------------------------------------
  // BATCH 5: Get monthly trends, rejection reasons, and achievements in parallel
  // -------------------------------------------------------------------------
  const [monthlyTrends, rejectionReasons, achievements] = await Promise.all([
    prisma.qCMonthlyTrend.findMany({
      where: {
        qcSpecialistId,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 6,
    }),
    prisma.qCRejectionReason.findMany({
      where: { qcSpecialistId },
      orderBy: { caseCount: "desc" },
      take: 5,
    }),
    prisma.qCAchievement.findMany({
      where: { qcSpecialistId },
    }),
  ]);

  // -------------------------------------------------------------------------
  // PROCESS RESULTS
  // -------------------------------------------------------------------------

  // Calculate totals from grouped stats
  let totalApproved = 0;
  let totalRejected = 0;

  const categoryStats: Record<string, { approved: number; rejected: number }> =
    {
      video: { approved: 0, rejected: 0 },
      design: { approved: 0, rejected: 0 },
      copywriting: { approved: 0, rejected: 0 },
    };

  for (const stat of taskStatsByStatusAndCategory) {
    const count = stat._count._all;
    const category = stat.taskCategory?.toLowerCase() || "other";

    if (stat.status === TaskStatus.COMPLETED) {
      totalApproved += count;
      if (categoryStats[category]) {
        categoryStats[category].approved += count;
      }
    } else if (stat.status === TaskStatus.REJECTED) {
      totalRejected += count;
      if (categoryStats[category]) {
        categoryStats[category].rejected += count;
      }
    }
  }

  const totalReviews = totalApproved + totalRejected;

  // Calculate average review time from sample
  let avgReviewTime = 0;
  if (recentCompletedTasks.length > 0) {
    const totalTimeMs = recentCompletedTasks.reduce((acc, task) => {
      const timeDiff =
        new Date(task.updatedAt).getTime() -
        new Date(task.createdAt).getTime();
      return acc + timeDiff;
    }, 0);
    avgReviewTime = Math.round(
      totalTimeMs / recentCompletedTasks.length / (1000 * 60)
    ); // Convert to minutes
  }

  const approvalRate =
    totalReviews > 0
      ? parseFloat(((totalApproved / totalReviews) * 100).toFixed(1))
      : 0;

  const firstPassRate =
    totalReviews > 0
      ? parseFloat(((firstPassCount / totalReviews) * 100).toFixed(1))
      : 0;

  // Process weekly stats
  let weeklyApproved = 0;
  let weeklyRejected = 0;

  for (const stat of weeklyStats) {
    if (stat.status === TaskStatus.COMPLETED) {
      weeklyApproved += stat._count._all;
    } else if (stat.status === TaskStatus.REJECTED) {
      weeklyRejected += stat._count._all;
    }
  }

  const weeklyTotalReviews = weeklyApproved + weeklyRejected;
  const weeklyFirstPassRate =
    weeklyTotalReviews > 0
      ? parseFloat(((weeklyFirstPassCount / weeklyTotalReviews) * 100).toFixed(1))
      : 0;

  // Build category breakdown
  const reviewsByCategory = Object.entries(categoryStats).map(
    ([category, stats]) => {
      const total = stats.approved + stats.rejected;
      const rate =
        total > 0
          ? parseFloat(((stats.approved / total) * 100).toFixed(1))
          : 0;

      return {
        category: category.charAt(0).toUpperCase() + category.slice(1),
        reviews: total,
        approvalRate: rate,
        status:
          rate >= 85 ? "Excellent" : rate >= 75 ? "Good" : "Needs Improvement",
      };
    }
  );

  // Build monthly trend (fill in missing months with 0)
  const monthlyTrend = buildMonthlyTrend(monthlyTrends);

  return {
    period,
    qcSpecialistId,
    performanceMetrics: {
      avgReviewTime,
      approvalRate,
      firstPassRate,
      thisWeekReviews: weeklyTotalReviews,
    },
    reviewsByCategory,
    topRejectionReasons: rejectionReasons.map((r) => ({
      reason: r.reason,
      cases: r.caseCount,
    })),
    monthlyTrend,
    weeklyBreakdown: {
      approved: weeklyApproved,
      rejected: weeklyRejected,
      avgTime: avgReviewTime,
      firstPassRate: weeklyFirstPassRate,
    },
    achievements: {
      qualityChampion: achievements.some(
        (a) => a.achievementType === "QUALITY_CHAMPION"
      ),
      speedReviewer: achievements.some(
        (a) => a.achievementType === "SPEED_REVIEWER"
      ),
    },
  };
}

function buildMonthlyTrend(
  trends: Array<{ year: number; month: number; reviewCount: number }>
): Array<{ month: string; reviews: number }> {
  const result: Array<{ month: string; reviews: number }> = [];
  const now = new Date();

  // Build last 6 months
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthName = date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    const existingTrend = trends.find(
      (t) => t.year === year && t.month === month
    );

    result.push({
      month: monthName,
      reviews: existingTrend?.reviewCount || 0,
    });
  }

  return result;
}

// ============================================================================
// GET ENDPOINT - Read-only, fast analytics fetch
// ============================================================================

export async function GET(req: Request) {
  try {
    // 🔒 AUTH
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      role: string;
      userId: number;
    };
    const { role, userId } = decoded;

    // Only QC and admin/manager can access analytics
    if (!["qc", "admin", "manager"].includes(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") || "month") as Period;
    const qcSpecialistId =
      role === "qc" ? userId : parseInt(searchParams.get("qcId") || "0");

    if (!qcSpecialistId) {
      return NextResponse.json(
        { message: "QC Specialist ID is required for admin/manager" },
        { status: 400 }
      );
    }

    // 📊 FETCH ANALYTICS — cached per specialist+period for 90s
    // Analytics data doesn't change second-to-second; this cuts 6+ DB queries per page load.
    const cacheKey = `qc-analytics:${qcSpecialistId}:${period}`;
    const analytics = await cached(cacheKey, () => getAnalytics(qcSpecialistId, period), 90);

    return NextResponse.json(analytics, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("❌ Analytics error:", error);
    return NextResponse.json(
      { message: "Server error", error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST ENDPOINT - Trigger analytics refresh (call from webhooks/cron)
// ============================================================================

export async function POST(req: Request) {
  try {
    // 🔒 AUTH
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      role: string;
      userId: number;
    };
    const { role, userId } = decoded;

    // Only QC and admin/manager can trigger refresh
    if (!["qc", "admin", "manager"].includes(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const qcSpecialistId =
      role === "qc" ? userId : parseInt(searchParams.get("qcId") || "0");

    if (!qcSpecialistId) {
      return NextResponse.json(
        { message: "QC Specialist ID is required" },
        { status: 400 }
      );
    }

    // 📊 UPDATE ANALYTICS DATA
    await refreshAnalytics(qcSpecialistId);

    return NextResponse.json(
      { message: "Analytics refreshed successfully" },
      { status: 200 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("❌ Analytics refresh error:", error);
    return NextResponse.json(
      { message: "Server error", error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================================
// REFRESH ANALYTICS - Update stored metrics
// ============================================================================

async function refreshAnalytics(qcSpecialistId: number): Promise<void> {
  const now = new Date();

  // Run all updates in parallel
  await Promise.all([
    updateRejectionReasons(qcSpecialistId),
    updateMonthlyTrend(qcSpecialistId, now.getFullYear(), now.getMonth() + 1),
    updateAchievements(qcSpecialistId),
  ]);
}

// Extract and track rejection reasons
async function updateRejectionReasons(qcSpecialistId: number): Promise<void> {
  const rejectedTasks = await prisma.task.findMany({
    where: {
      qc_specialist: qcSpecialistId,
      status: TaskStatus.REJECTED,
      qcNotes: { not: null },
    },
    select: {
      id: true,
      qcNotes: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  // Keywords to track
  const keywords: Record<string, string[]> = {
    "Brand color": ["brand color", "color mismatch", "color match"],
    Typography: ["typography", "font", "text size", "font size"],
    "Audio quality": ["audio", "sound", "music", "voice-over", "volume"],
    "Grid alignment": ["grid", "alignment", "align", "spacing"],
    "Missing elements": ["missing", "incomplete", "required"],
    "Aspect ratio": ["aspect ratio", "resolution", "dimensions"],
    Contrast: ["contrast", "visibility", "clarity"],
  };

  // Build all upsert operations
  const upsertOps = [];

  for (const [reasonName, keywordsList] of Object.entries(keywords)) {
    let matchCount = 0;
    const matchedTaskIds: string[] = [];

    for (const task of rejectedTasks) {
      if (task.qcNotes) {
        const hasKeyword = keywordsList.some((kw) =>
          task.qcNotes?.toLowerCase().includes(kw.toLowerCase())
        );
        if (hasKeyword) {
          matchCount++;
          matchedTaskIds.push(task.id);
        }
      }
    }

    if (matchCount > 0) {
      upsertOps.push(
        prisma.qCRejectionReason.upsert({
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
          },
        })
      );
    }
  }

  // Execute all upserts in parallel
  if (upsertOps.length > 0) {
    await Promise.all(upsertOps);
  }
}

// Update monthly trend
async function updateMonthlyTrend(
  qcSpecialistId: number,
  year: number,
  month: number
): Promise<void> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // Get all stats in one query
  const stats = await prisma.task.groupBy({
    by: ["status"],
    where: {
      qc_specialist: qcSpecialistId,
      status: { in: [TaskStatus.COMPLETED, TaskStatus.REJECTED] },
      updatedAt: { gte: monthStart, lte: monthEnd },
    },
    _count: {
      _all: true,
    },
  });

  let approvedCount = 0;
  let rejectedCount = 0;

  for (const stat of stats) {
    if (stat.status === TaskStatus.COMPLETED) {
      approvedCount = stat._count._all;
    } else if (stat.status === TaskStatus.REJECTED) {
      rejectedCount = stat._count._all;
    }
  }

  const totalReviews = approvedCount + rejectedCount;

  // Get average review time from sample
  const sampleTasks = await prisma.task.findMany({
    where: {
      qc_specialist: qcSpecialistId,
      status: { in: [TaskStatus.COMPLETED, TaskStatus.REJECTED] },
      updatedAt: { gte: monthStart, lte: monthEnd },
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
    take: 50,
  });

  let avgTime = 0;
  if (sampleTasks.length > 0) {
    const totalTimeMs = sampleTasks.reduce((acc, task) => {
      return (
        acc +
        (new Date(task.updatedAt).getTime() -
          new Date(task.createdAt).getTime())
      );
    }, 0);
    avgTime = Math.round(totalTimeMs / sampleTasks.length / (1000 * 60));
  }

  const approvalRate =
    totalReviews > 0
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

// Check and award achievements
async function updateAchievements(qcSpecialistId: number): Promise<void> {
  const { startDate: monthStart, endDate: monthEnd } = getDateRange("month");
  const { startDate: weekStart, endDate: weekEnd } = getDateRange("week");

  // Get monthly and weekly stats in parallel
  const [monthlyStats, weeklyCount] = await Promise.all([
    prisma.task.groupBy({
      by: ["status"],
      where: {
        qc_specialist: qcSpecialistId,
        status: { in: [TaskStatus.COMPLETED, TaskStatus.REJECTED] },
        updatedAt: { gte: monthStart, lte: monthEnd },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.task.count({
      where: {
        qc_specialist: qcSpecialistId,
        status: { in: [TaskStatus.COMPLETED, TaskStatus.REJECTED] },
        updatedAt: { gte: weekStart, lte: weekEnd },
      },
    }),
  ]);

  let monthlyApproved = 0;
  let monthlyTotal = 0;

  for (const stat of monthlyStats) {
    monthlyTotal += stat._count._all;
    if (stat.status === TaskStatus.COMPLETED) {
      monthlyApproved = stat._count._all;
    }
  }

  const approvalRate =
    monthlyTotal > 0 ? (monthlyApproved / monthlyTotal) * 100 : 0;

  // Batch achievement operations
  const operations = [];

  // Quality Champion: 90%+ approval rate for the month
  if (approvalRate >= 90) {
    operations.push(
      prisma.qCAchievement.upsert({
        where: {
          qcSpecialistId_achievementType: {
            qcSpecialistId,
            achievementType: "QUALITY_CHAMPION",
          },
        },
        create: {
          qcSpecialistId,
          achievementType: "QUALITY_CHAMPION",
          achievementData: { approvalRate },
        },
        update: {
          achievementData: { approvalRate },
        },
      })
    );
  } else {
    operations.push(
      prisma.qCAchievement.deleteMany({
        where: {
          qcSpecialistId,
          achievementType: "QUALITY_CHAMPION",
        },
      })
    );
  }

  // Speed Reviewer: 50+ reviews in a week
  if (weeklyCount >= 50) {
    operations.push(
      prisma.qCAchievement.upsert({
        where: {
          qcSpecialistId_achievementType: {
            qcSpecialistId,
            achievementType: "SPEED_REVIEWER",
          },
        },
        create: {
          qcSpecialistId,
          achievementType: "SPEED_REVIEWER",
          achievementData: { reviewCount: weeklyCount },
        },
        update: {
          achievementData: { reviewCount: weeklyCount },
        },
      })
    );
  } else {
    operations.push(
      prisma.qCAchievement.deleteMany({
        where: {
          qcSpecialistId,
          achievementType: "SPEED_REVIEWER",
        },
      })
    );
  }

  await Promise.all(operations);
}