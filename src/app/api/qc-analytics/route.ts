export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import "@/lib/bigint-fix";
import { getDb } from "@/lib/db";
import { task, qcMonthlyTrend, qcRejectionReason, qcAchievement } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, eq, gte, lte, inArray, isNull, isNotNull, count, desc } from "drizzle-orm";
import { cached } from "@/lib/redis";

const TaskStatus = {
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
} as const;

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
  const { db, closeDb } = getDb();
  try {
  const { startDate, endDate } = getDateRange(period);
  const weekRange = getDateRange("week");

  // -------------------------------------------------------------------------
  // BATCH 1: Get all task stats grouped by status and category
  // -------------------------------------------------------------------------
  const taskStatsByStatusAndCategory = await db
    .select({ status: task.status, taskCategory: task.taskCategory, _count: count() })
    .from(task)
    .where(and(
      eq(task.qcSpecialist, qcSpecialistId),
      inArray(task.status, [TaskStatus.COMPLETED, TaskStatus.REJECTED]),
      gte(task.updatedAt, startDate.toISOString()),
      lte(task.updatedAt, endDate.toISOString()),
    ))
    .groupBy(task.status, task.taskCategory);

  // -------------------------------------------------------------------------
  // BATCH 2: Get weekly stats separately (different date range)
  // -------------------------------------------------------------------------
  const weeklyStats = await db
    .select({ status: task.status, _count: count() })
    .from(task)
    .where(and(
      eq(task.qcSpecialist, qcSpecialistId),
      inArray(task.status, [TaskStatus.COMPLETED, TaskStatus.REJECTED]),
      gte(task.updatedAt, weekRange.startDate.toISOString()),
      lte(task.updatedAt, weekRange.endDate.toISOString()),
    ))
    .groupBy(task.status);

  // -------------------------------------------------------------------------
  // BATCH 3: Get first-pass count (approved without QC notes = no revisions)
  // -------------------------------------------------------------------------
  const [[firstPassCountRow], [weeklyFirstPassCountRow]] = await Promise.all([
    db.select({ value: count() }).from(task).where(and(
      eq(task.qcSpecialist, qcSpecialistId),
      eq(task.status, TaskStatus.COMPLETED),
      isNull(task.qcNotes), // No QC notes means approved on first pass
      gte(task.updatedAt, startDate.toISOString()),
      lte(task.updatedAt, endDate.toISOString()),
    )),
    db.select({ value: count() }).from(task).where(and(
      eq(task.qcSpecialist, qcSpecialistId),
      eq(task.status, TaskStatus.COMPLETED),
      isNull(task.qcNotes),
      gte(task.updatedAt, weekRange.startDate.toISOString()),
      lte(task.updatedAt, weekRange.endDate.toISOString()),
    )),
  ]);
  const firstPassCount = firstPassCountRow.value;
  const weeklyFirstPassCount = weeklyFirstPassCountRow.value;

  // -------------------------------------------------------------------------
  // BATCH 4: Get sample of completed tasks for average review time calculation
  // NOTE: This calculates total task lifetime (createdAt to updatedAt).
  // For accurate QC review time, consider adding qcStartedAt field to Task.
  // -------------------------------------------------------------------------
  const recentCompletedTasks = await db
    .select({ createdAt: task.createdAt, updatedAt: task.updatedAt })
    .from(task)
    .where(and(
      eq(task.qcSpecialist, qcSpecialistId),
      inArray(task.status, [TaskStatus.COMPLETED, TaskStatus.REJECTED]),
      gte(task.updatedAt, startDate.toISOString()),
      lte(task.updatedAt, endDate.toISOString()),
    ))
    .orderBy(desc(task.updatedAt))
    .limit(100); // Sample for performance

  // -------------------------------------------------------------------------
  // BATCH 5: Get monthly trends, rejection reasons, and achievements in parallel
  // -------------------------------------------------------------------------
  const [monthlyTrends, rejectionReasons, achievements] = await Promise.all([
    db.select().from(qcMonthlyTrend)
      .where(eq(qcMonthlyTrend.qcSpecialistId, qcSpecialistId))
      .orderBy(desc(qcMonthlyTrend.year), desc(qcMonthlyTrend.month))
      .limit(6),
    db.select().from(qcRejectionReason)
      .where(eq(qcRejectionReason.qcSpecialistId, qcSpecialistId))
      .orderBy(desc(qcRejectionReason.caseCount))
      .limit(5),
    db.select().from(qcAchievement)
      .where(eq(qcAchievement.qcSpecialistId, qcSpecialistId)),
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
    const statCount = stat._count;
    const category = stat.taskCategory?.toLowerCase() || "other";

    if (stat.status === TaskStatus.COMPLETED) {
      totalApproved += statCount;
      if (categoryStats[category]) {
        categoryStats[category].approved += statCount;
      }
    } else if (stat.status === TaskStatus.REJECTED) {
      totalRejected += statCount;
      if (categoryStats[category]) {
        categoryStats[category].rejected += statCount;
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
      weeklyApproved += stat._count;
    } else if (stat.status === TaskStatus.REJECTED) {
      weeklyRejected += stat._count;
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

  } finally {
    await closeDb();
  }
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
  const { db, closeDb } = getDb();
  try {
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

  } finally {
    await closeDb();
  }
}

// ============================================================================
// POST ENDPOINT - Trigger analytics refresh (call from webhooks/cron)
// ============================================================================

export async function POST(req: Request) {
  const { db, closeDb } = getDb();
  try {
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

  } finally {
    await closeDb();
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
  const { db, closeDb } = getDb();
  try {
  const rejectedTasks = await db
    .select({ id: task.id, qcNotes: task.qcNotes })
    .from(task)
    .where(and(
      eq(task.qcSpecialist, qcSpecialistId),
      eq(task.status, TaskStatus.REJECTED),
      isNotNull(task.qcNotes),
    ))
    .orderBy(desc(task.updatedAt))
    .limit(100);

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
        db.insert(qcRejectionReason).values({
          id: createId(),
          qcSpecialistId,
          reason: reasonName,
          caseCount: matchCount,
          taskIds: matchedTaskIds,
          lastOccurrence: new Date().toISOString(),
        }).onConflictDoUpdate({
          target: [qcRejectionReason.qcSpecialistId, qcRejectionReason.reason],
          set: {
            caseCount: matchCount,
            taskIds: matchedTaskIds,
            lastOccurrence: new Date().toISOString(),
          },
        })
      );
    }
  }

  // Execute all upserts in parallel
  if (upsertOps.length > 0) {
    await Promise.all(upsertOps);
  }

  } finally {
    await closeDb();
  }
}

// Update monthly trend
async function updateMonthlyTrend(
  qcSpecialistId: number,
  year: number,
  month: number
): Promise<void> {
  const { db, closeDb } = getDb();
  try {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // Get all stats in one query
  const stats = await db
    .select({ status: task.status, _count: count() })
    .from(task)
    .where(and(
      eq(task.qcSpecialist, qcSpecialistId),
      inArray(task.status, [TaskStatus.COMPLETED, TaskStatus.REJECTED]),
      gte(task.updatedAt, monthStart.toISOString()),
      lte(task.updatedAt, monthEnd.toISOString()),
    ))
    .groupBy(task.status);

  let approvedCount = 0;
  let rejectedCount = 0;

  for (const stat of stats) {
    if (stat.status === TaskStatus.COMPLETED) {
      approvedCount = stat._count;
    } else if (stat.status === TaskStatus.REJECTED) {
      rejectedCount = stat._count;
    }
  }

  const totalReviews = approvedCount + rejectedCount;

  // Get average review time from sample
  const sampleTasks = await db
    .select({ createdAt: task.createdAt, updatedAt: task.updatedAt })
    .from(task)
    .where(and(
      eq(task.qcSpecialist, qcSpecialistId),
      inArray(task.status, [TaskStatus.COMPLETED, TaskStatus.REJECTED]),
      gte(task.updatedAt, monthStart.toISOString()),
      lte(task.updatedAt, monthEnd.toISOString()),
    ))
    .limit(50);

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

  // numeric() columns are typed `string` in drizzle — wrap values in String().
  await db.insert(qcMonthlyTrend).values({
    id: createId(),
    qcSpecialistId,
    year,
    month,
    reviewCount: totalReviews,
    approvedCount,
    rejectedCount,
    avgReviewTime: String(avgTime),
    approvalRate: String(approvalRate),
  }).onConflictDoUpdate({
    target: [qcMonthlyTrend.qcSpecialistId, qcMonthlyTrend.year, qcMonthlyTrend.month],
    set: {
      reviewCount: totalReviews,
      approvedCount,
      rejectedCount,
      avgReviewTime: String(avgTime),
      approvalRate: String(approvalRate),
    },
  });

  } finally {
    await closeDb();
  }
}

// Check and award achievements
async function updateAchievements(qcSpecialistId: number): Promise<void> {
  const { db, closeDb } = getDb();
  try {
  const { startDate: monthStart, endDate: monthEnd } = getDateRange("month");
  const { startDate: weekStart, endDate: weekEnd } = getDateRange("week");

  // Get monthly and weekly stats in parallel
  const [monthlyStats, [weeklyCountRow]] = await Promise.all([
    db.select({ status: task.status, _count: count() })
      .from(task)
      .where(and(
        eq(task.qcSpecialist, qcSpecialistId),
        inArray(task.status, [TaskStatus.COMPLETED, TaskStatus.REJECTED]),
        gte(task.updatedAt, monthStart.toISOString()),
        lte(task.updatedAt, monthEnd.toISOString()),
      ))
      .groupBy(task.status),
    db.select({ value: count() }).from(task).where(and(
      eq(task.qcSpecialist, qcSpecialistId),
      inArray(task.status, [TaskStatus.COMPLETED, TaskStatus.REJECTED]),
      gte(task.updatedAt, weekStart.toISOString()),
      lte(task.updatedAt, weekEnd.toISOString()),
    )),
  ]);
  const weeklyCount = weeklyCountRow.value;

  let monthlyApproved = 0;
  let monthlyTotal = 0;

  for (const stat of monthlyStats) {
    monthlyTotal += stat._count;
    if (stat.status === TaskStatus.COMPLETED) {
      monthlyApproved = stat._count;
    }
  }

  const approvalRate =
    monthlyTotal > 0 ? (monthlyApproved / monthlyTotal) * 100 : 0;

  // Batch achievement operations
  const operations = [];

  // Quality Champion: 90%+ approval rate for the month
  if (approvalRate >= 90) {
    operations.push(
      db.insert(qcAchievement).values({
        id: createId(),
        qcSpecialistId,
        achievementType: "QUALITY_CHAMPION",
        achievementData: { approvalRate },
      }).onConflictDoUpdate({
        target: [qcAchievement.qcSpecialistId, qcAchievement.achievementType],
        set: { achievementData: { approvalRate } },
      })
    );
  } else {
    operations.push(
      db.delete(qcAchievement).where(and(
        eq(qcAchievement.qcSpecialistId, qcSpecialistId),
        eq(qcAchievement.achievementType, "QUALITY_CHAMPION"),
      ))
    );
  }

  // Speed Reviewer: 50+ reviews in a week
  if (weeklyCount >= 50) {
    operations.push(
      db.insert(qcAchievement).values({
        id: createId(),
        qcSpecialistId,
        achievementType: "SPEED_REVIEWER",
        achievementData: { reviewCount: weeklyCount },
      }).onConflictDoUpdate({
        target: [qcAchievement.qcSpecialistId, qcAchievement.achievementType],
        set: { achievementData: { reviewCount: weeklyCount } },
      })
    );
  } else {
    operations.push(
      db.delete(qcAchievement).where(and(
        eq(qcAchievement.qcSpecialistId, qcSpecialistId),
        eq(qcAchievement.achievementType, "SPEED_REVIEWER"),
      ))
    );
  }

  await Promise.all(operations);

  } finally {
    await closeDb();
  }
}