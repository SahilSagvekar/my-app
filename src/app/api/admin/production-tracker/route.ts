import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { cached } from "@/lib/redis";

// GET /api/admin/production-tracker?month=April-2026
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !["admin", "manager"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // e.g. "April-2026"

    // Default to current month
    const now = new Date();
    const currentMonthName = now.toLocaleString("en-US", { month: "long" });
    const currentYear = now.getFullYear();
    const targetMonth = monthParam || `${currentMonthName}-${currentYear}`;

    // Parse month for date range filtering
    const [monthName, yearStr] = targetMonth.split("-");
    const monthIndex = new Date(`${monthName} 1, ${yearStr}`).getMonth();
    const year = parseInt(yearStr);
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    // Cached per month — 120s TTL. Tasks change every few minutes at most,
    // and this route runs 3 heavy queries. Cache dramatically reduces DB load.
    const cacheKey = `production-tracker:${targetMonth}`;
    const cachedResult = await cached(cacheKey, async () => {

    // 1. Get all active clients with their monthly deliverables
    const clients = await prisma.client.findMany({
      where: { status: "active" },
      select: {
        id: true,
        name: true,
        companyName: true,
        // isTrial: true,
        monthlyDeliverables: {
          select: {
            id: true,
            type: true,
            quantity: true,
            // isTrial: true,
          },
        },
      },
      orderBy: { companyName: "asc" },
    });

    // 2. Get all tasks for the target month
    const tasks = await prisma.task.findMany({
      where: {
        OR: [
          { monthFolder: targetMonth },
          // Also catch tasks created in this month range
          {
            createdAt: { gte: monthStart, lte: monthEnd },
            monthFolder: null,
          },
        ],
        clientId: { not: null },
      },
      select: {
        id: true,
        title: true,
        status: true,
        assignedTo: true,
        qcReviewedBy: true,
        scheduler: true,
        clientId: true,
        monthlyDeliverableId: true,
        oneOffDeliverableId: true,
        deliverableType: true,
        // isTrial: true,
        createdAt: true,
        updatedAt: true,
        dueDate: true,
        qcReviewedAt: true,
        socialMediaLinks: true,
        monthFolder: true,
        isExtra: true,
        extraSequence: true,
        monthlyDeliverable: {
          select: {
            id: true,
            type: true,
            quantity: true,
          },
        },
        oneOffDeliverable: {
          select: {
            id: true,
            type: true,
            quantity: true,
          },
        },
      },
    });

    // 3. Get all editors, QC, schedulers
    const employees = await prisma.user.findMany({
      where: {
        role: { in: ["editor", "qc", "scheduler", "admin"] },
        employeeStatus: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
      },
    });

    // ─── Build Client Deliverable Progress ───
    const clientProgress = clients.map((client) => {
      const clientTasks = tasks.filter((t) => t.clientId === client.id);

      const deliverables = client.monthlyDeliverables.map((del) => {
        // Find tasks linked to this deliverable
        const delTasks = clientTasks.filter(
          (t) => t.monthlyDeliverableId === del.id
        );

        // Also find tasks matching by type if not linked
        const typeMatchTasks =
          delTasks.length === 0
            ? clientTasks.filter(
                (t) =>
                  !t.monthlyDeliverableId &&
                  (t.deliverableType === del.type ||
                    t.monthlyDeliverable?.type === del.type)
              )
            : [];

        const allDelTasks = [...delTasks, ...typeMatchTasks];
        const promisedDelTasks = allDelTasks.filter((t) => !t.isExtra);
        const extraTasks = allDelTasks.filter((t) => t.isExtra);

        const statusCounts = {
          total: allDelTasks.length,
          pending: allDelTasks.filter(
            (t) =>
              t.status === "PENDING" || t.status === "VIDEOGRAPHER_ASSIGNED"
          ).length,
          inProgress: allDelTasks.filter(
            (t) => t.status === "IN_PROGRESS"
          ).length,
          readyForQc: allDelTasks.filter(
            (t) => t.status === "READY_FOR_QC" || t.status === "QC_IN_PROGRESS"
          ).length,
          completed: allDelTasks.filter(
            (t) => t.status === "COMPLETED"
          ).length,
          scheduled: allDelTasks.filter(
            (t) => t.status === "SCHEDULED"
          ).length,
          posted: allDelTasks.filter((t) => t.status === "POSTED").length,
          clientReview: allDelTasks.filter(
            (t) => t.status === "CLIENT_REVIEW"
          ).length,
          onHold: allDelTasks.filter(
            (t) => t.status === "ON_HOLD" || t.status === "REJECTED"
          ).length,
        };

        // "Done" = completed + scheduled + posted, excluding intentional extras
        const doneCount =
          promisedDelTasks.filter(
            (t) =>
              t.status === "COMPLETED" ||
              t.status === "SCHEDULED" ||
              t.status === "POSTED"
          ).length;
        const extraDoneCount = extraTasks.filter(
          (t) =>
            t.status === "COMPLETED" ||
            t.status === "SCHEDULED" ||
            t.status === "POSTED"
        ).length;
        const progressPercent =
          del.quantity > 0
            ? Math.min(100, Math.round((doneCount / del.quantity) * 100))
            : 0;

        return {
          deliverableId: del.id,
          type: del.type,
          promised: del.quantity,
          // isTrial: del.isTrial,
          statusCounts,
          doneCount,
          extraCount: extraTasks.length,
          extraDoneCount,
          progressPercent,
          // Health: red if <50% done and past mid-month, yellow if 50-80%, green if >80%
          health: getHealth(progressPercent, monthStart, monthEnd),
        };
      });

      // Overall client health
      const totalPromised = deliverables.reduce(
        (s, d) => s + d.promised,
        0
      );
      const totalDone = deliverables.reduce((s, d) => s + d.doneCount, 0);
      const overallProgress =
        totalPromised > 0
          ? Math.round((totalDone / totalPromised) * 100)
          : 0;

      return {
        clientId: client.id,
        clientName: client.companyName || client.name,
        // isTrial: client.isTrial,
        deliverables,
        totalTasks: clientTasks.length,
        totalPromised,
        totalDone,
        totalExtraTasks: deliverables.reduce((s, d) => s + d.extraCount, 0),
        totalExtraDone: deliverables.reduce((s, d) => s + d.extraDoneCount, 0),
        overallProgress,
        health: getHealth(overallProgress, monthStart, monthEnd),
      };
    });

    // ─── Build Employee Performance ───
    const editorPerf = buildEditorPerformance(employees, tasks, "editor");
    const qcPerf = buildQCPerformance(employees, tasks);
    const schedulerPerf = buildSchedulerPerformance(employees, tasks);

    // ─── At-Risk Clients (progress < 60% past mid-month, or < 30% any time) ───
    const atRiskClients = clientProgress
      .filter(
        (c) =>
          c.totalPromised > 0 &&
          (c.health === "critical" || c.health === "warning")
      )
      .sort((a, b) => a.overallProgress - b.overallProgress);

    const statusSummary = {
      all: tasks.length,
      pending: tasks.filter(
        (t) =>
          t.status === "PENDING" || t.status === "VIDEOGRAPHER_ASSIGNED"
      ).length,
      inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
      readyForQc: tasks.filter(
        (t) => t.status === "READY_FOR_QC" || t.status === "QC_IN_PROGRESS"
      ).length,
      clientReview: tasks.filter((t) => t.status === "CLIENT_REVIEW").length,
      completed: tasks.filter((t) => t.status === "COMPLETED").length,
      scheduled: tasks.filter((t) => t.status === "SCHEDULED").length,
      posted: tasks.filter((t) => t.status === "POSTED").length,
    };

    // ─── Summary Stats ───
    const summary = {
      totalClients: clients.filter((c) => c.monthlyDeliverables.length > 0)
        .length,
      totalTasksThisMonth: tasks.length,
      totalPromised: clientProgress.reduce((s, c) => s + c.totalPromised, 0),
      totalDone: clientProgress.reduce((s, c) => s + c.totalDone, 0),
      totalInProgress: tasks.filter(
        (t) =>
          t.status === "IN_PROGRESS" ||
          t.status === "READY_FOR_QC" ||
          t.status === "QC_IN_PROGRESS"
      ).length,
      totalPending: tasks.filter(
        (t) =>
          t.status === "PENDING" || t.status === "VIDEOGRAPHER_ASSIGNED"
      ).length,
      totalPosted: tasks.filter((t) => t.status === "POSTED").length,
      atRiskCount: atRiskClients.length,
      overallProgress:
        clientProgress.reduce((s, c) => s + c.totalPromised, 0) > 0
          ? Math.round(
              (clientProgress.reduce((s, c) => s + c.totalDone, 0) /
                clientProgress.reduce((s, c) => s + c.totalPromised, 0)) *
                100
            )
          : 0,
    };

    // ─── Available months (for dropdown) ───
    const monthFolders = await prisma.task.findMany({
      where: { monthFolder: { not: null } },
      select: { monthFolder: true },
      distinct: ["monthFolder"],
    });
    const availableMonths = [
      ...new Set(
        monthFolders
          .map((t) => t.monthFolder)
          .filter(Boolean) as string[]
      ),
    ].sort((a, b) => {
      const [mA, yA] = a.split("-");
      const [mB, yB] = b.split("-");
      const dA = new Date(`${mA} 1, ${yA}`);
      const dB = new Date(`${mB} 1, ${yB}`);
      return dB.getTime() - dA.getTime(); // newest first
    });

    return {
      month: targetMonth,
      summary,
      statusSummary,
      clientProgress,
      editorPerformance: editorPerf,
      qcPerformance: qcPerf,
      schedulerPerformance: schedulerPerf,
      atRiskClients,
      availableMonths,
    };
    }, 120); // 120s TTL

    return NextResponse.json(cachedResult);
  } catch (err: any) {
    console.error("Production tracker error:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message },
      { status: 500 }
    );
  }
}

// ─── Helpers ───

function getHealth(
  progressPercent: number,
  monthStart: Date,
  monthEnd: Date
): "healthy" | "warning" | "critical" {
  const now = new Date();
  const totalDays = Math.ceil(
    (monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysPassed = Math.max(
    0,
    Math.ceil(
      (now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const monthProgress = totalDays > 0 ? daysPassed / totalDays : 0;

  // If month hasn't started yet, be lenient
  if (now < monthStart) return "healthy";

  // If month is over
  if (now > monthEnd) {
    if (progressPercent >= 90) return "healthy";
    if (progressPercent >= 60) return "warning";
    return "critical";
  }

  // During the month: compare task progress vs time progress
  // Expected progress should roughly match time progress
  const expectedProgress = monthProgress * 100;
  const gap = expectedProgress - progressPercent;

  if (gap > 30) return "critical";
  if (gap > 15) return "warning";
  return "healthy";
}

function buildEditorPerformance(
  employees: any[],
  tasks: any[],
  role: string
) {
  const editors = employees.filter(
    (e) => e.role?.toLowerCase() === role
  );

  return editors.map((editor) => {
    const editorTasks = tasks.filter((t) => t.assignedTo === editor.id);

    const statusBreakdown = {
      total: editorTasks.length,
      pending: editorTasks.filter(
        (t) =>
          t.status === "PENDING" || t.status === "VIDEOGRAPHER_ASSIGNED"
      ).length,
      inProgress: editorTasks.filter(
        (t) => t.status === "IN_PROGRESS"
      ).length,
      readyForQc: editorTasks.filter(
        (t) =>
          t.status === "READY_FOR_QC" || t.status === "QC_IN_PROGRESS"
      ).length,
      completed: editorTasks.filter(
        (t) =>
          t.status === "COMPLETED" ||
          t.status === "SCHEDULED" ||
          t.status === "POSTED"
      ).length,
      onHold: editorTasks.filter(
        (t) => t.status === "ON_HOLD" || t.status === "REJECTED"
      ).length,
      clientReview: editorTasks.filter(
        (t) => t.status === "CLIENT_REVIEW"
      ).length,
    };

    // Completion rate
    const completionRate =
      editorTasks.length > 0
        ? Math.round(
            (statusBreakdown.completed / editorTasks.length) * 100
          )
        : 0;

    // Avg turnaround: from createdAt to when task reached COMPLETED/SCHEDULED/POSTED
    const completedTasks = editorTasks.filter(
      (t) =>
        (t.status === "COMPLETED" ||
          t.status === "SCHEDULED" ||
          t.status === "POSTED") &&
        t.updatedAt &&
        t.createdAt
    );

    let avgTurnaroundDays = 0;
    if (completedTasks.length > 0) {
      const totalDays = completedTasks.reduce((sum: number, t: any) => {
        const diff =
          new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0);
      avgTurnaroundDays = Math.round((totalDays / completedTasks.length) * 10) / 10;
    }

    // Which clients they work on
    const clientIds = [...new Set(editorTasks.map((t: any) => t.clientId).filter(Boolean))];

    return {
      id: editor.id,
      name: editor.name || editor.email,
      role: editor.role,
      statusBreakdown,
      completionRate,
      avgTurnaroundDays,
      clientCount: clientIds.length,
    };
  });
}

function buildQCPerformance(employees: any[], tasks: any[]) {
  // QC reviewers — anyone who has qcReviewedBy set
  const qcReviewerIds = [
    ...new Set(tasks.map((t) => t.qcReviewedBy).filter(Boolean)),
  ];

  // Also include users with qc role
  const qcUsers = employees.filter(
    (e) =>
      e.role?.toLowerCase() === "qc" || qcReviewerIds.includes(e.id)
  );

  // Deduplicate
  const seen = new Set<number>();
  const uniqueQC = qcUsers.filter((u) => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });

  return uniqueQC.map((qcUser) => {
    const reviewedTasks = tasks.filter(
      (t) => t.qcReviewedBy === qcUser.id
    );

    // Tasks that went through QC
    const passedCount = reviewedTasks.filter(
      (t) =>
        t.status === "COMPLETED" ||
        t.status === "SCHEDULED" ||
        t.status === "POSTED"
    ).length;

    const rejectedCount = reviewedTasks.filter(
      (t) => t.status === "REJECTED" || t.status === "ON_HOLD"
    ).length;

    // Avg review time: from READY_FOR_QC to qcReviewedAt
    let avgReviewHours = 0;
    const reviewedWithTime = reviewedTasks.filter(
      (t) => t.qcReviewedAt && t.createdAt
    );
    if (reviewedWithTime.length > 0) {
      const totalHours = reviewedWithTime.reduce(
        (sum: number, t: any) => {
          // Approximate: qcReviewedAt - some point before
          const reviewDate = new Date(t.qcReviewedAt);
          const createDate = new Date(t.createdAt);
          return (
            sum +
            (reviewDate.getTime() - createDate.getTime()) /
              (1000 * 60 * 60)
          );
        },
        0
      );
      avgReviewHours =
        Math.round((totalHours / reviewedWithTime.length) * 10) / 10;
    }

    return {
      id: qcUser.id,
      name: qcUser.name || qcUser.email,
      role: qcUser.role,
      totalReviewed: reviewedTasks.length,
      passed: passedCount,
      rejected: rejectedCount,
      passRate:
        reviewedTasks.length > 0
          ? Math.round((passedCount / reviewedTasks.length) * 100)
          : 0,
      avgReviewHours,
    };
  });
}

function buildSchedulerPerformance(employees: any[], tasks: any[]) {
  // Find schedulers — users with scheduler role or tasks with scheduler field
  const schedulerIds = [
    ...new Set(tasks.map((t) => t.scheduler).filter(Boolean)),
  ];

  const schedulerUsers = employees.filter(
    (e) =>
      e.role?.toLowerCase() === "scheduler" ||
      schedulerIds.includes(e.id)
  );

  const seen = new Set<number>();
  const uniqueSchedulers = schedulerUsers.filter((u) => {
    if (seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });

  return uniqueSchedulers.map((sched) => {
    const schedTasks = tasks.filter((t) => t.scheduler === sched.id);

    const scheduled = schedTasks.filter(
      (t) => t.status === "SCHEDULED" || t.status === "POSTED"
    ).length;

    const posted = schedTasks.filter(
      (t) => t.status === "POSTED"
    ).length;

    // Check social media links to count how many have been posted with links
    const withLinks = schedTasks.filter((t) => {
      const links = t.socialMediaLinks;
      if (Array.isArray(links) && links.length > 0) return true;
      return false;
    }).length;

    return {
      id: sched.id,
      name: sched.name || sched.email,
      role: sched.role,
      totalAssigned: schedTasks.length,
      scheduled,
      posted,
      withLinks,
      postRate:
        schedTasks.length > 0
          ? Math.round((posted / schedTasks.length) * 100)
          : 0,
    };
  });
}