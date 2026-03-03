export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

type PostingSchedule = "weekly" | "bi-weekly" | "monthly" | "custom";

// ─────────────────────────────────────────
// S3 Client
// ─────────────────────────────────────────

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ─────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────

const WEEKDAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

function getDeliverableShortCode(type: string): string {
  const normalized = type.toLowerCase().trim();
  if (normalized === "short form videos") return "SF";
  if (normalized === "long form videos") return "LF";
  if (normalized === "square form videos") return "SQF";
  if (normalized === "thumbnails") return "THUMB";
  if (normalized === "tiles") return "T";
  if (normalized === "hard posts / graphic images") return "HP";
  if (normalized === "snapchat episodes") return "SEP";
  if (normalized === "beta short form") return "BSF";
  return type.replace(/\s+/g, "");
}

function formatDateMMDDYYYY(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

function parseTimeToDate(base: Date, timeStr: string): Date {
  const [hh, mm] = timeStr.split(":").map(Number);
  const d = new Date(base);
  d.setHours(hh, mm ?? 0, 0, 0);
  return d;
}

function parseDayOfMonthLabel(label: string): number | null {
  const match = label.match(/^(\d+)(st|nd|rd|th)$/i);
  if (!match) return null;
  return parseInt(match[1], 10);
}

// ─────────────────────────────────────────
// S3 Folder Creation
// ─────────────────────────────────────────

async function createTaskFolderStructure(
  companyName: string,
  taskTitle: string,
  monthFolder: string
): Promise<string> {
  // Monthly grouped path: CompanyName/outputs/Month-Year/TaskTitle/
  const monthFolderPath = `${companyName}/outputs/${monthFolder}/`;
  const taskFolderPath = `${monthFolderPath}${taskTitle}/`;

  try {
    // Create month folder + task folder + subfolders
    const folders = [
      monthFolderPath,
      taskFolderPath,
      `${taskFolderPath}thumbnails/`,
      `${taskFolderPath}tiles/`,
      `${taskFolderPath}music-license/`,
    ];

    await Promise.all(
      folders.map((folder) =>
        s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: folder,
            ContentType: "application/x-directory",
          })
        )
      )
    );

    console.log("✅ Task folder created:", taskFolderPath);
    return taskFolderPath;
  } catch (error) {
    console.error("❌ Failed to create task folder:", error);
    throw error;
  }
}

// ─────────────────────────────────────────
// Posting Date Generation
// ─────────────────────────────────────────

function generatePostingDatesForMonth(opts: {
  year: number;
  month: number; // 0-based
  quantity: number;
  videosPerDay: number;
  postingSchedule: PostingSchedule;
  postingDays: string[];
  postingTimes: string[];
}): Date[] {
  const {
    year,
    month,
    quantity,
    videosPerDay,
    postingSchedule,
    postingDays,
    postingTimes,
  } = opts;

  const result: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const slotsNeeded = quantity;

  // Normalize times
  const times = [...postingTimes];
  while (times.length < videosPerDay) {
    times.push(times[times.length - 1] || "10:00");
  }

  // Monthly with specific dates (e.g., "1st", "15th")
  const hasNumericDays = postingDays.some((d) => parseDayOfMonthLabel(d) !== null);

  if (postingSchedule === "monthly" && hasNumericDays) {
    for (const label of postingDays) {
      const dom = parseDayOfMonthLabel(label);
      if (!dom || dom > daysInMonth) continue;

      const baseDate = new Date(year, month, dom);
      for (let i = 0; i < videosPerDay; i++) {
        result.push(parseTimeToDate(baseDate, times[i]));
        if (result.length >= slotsNeeded) return result;
      }
    }
    return result.slice(0, slotsNeeded);
  }

  // Weekly / Bi-weekly / Custom with weekday names
  const targetWeekdays = postingDays
    .map((d) => WEEKDAY_MAP[d])
    .filter((v) => v !== undefined);

  // 🔥 FALLBACK: If no valid posting days, use ALL days of the month
  // This ensures tasks are always created even if postingDays isn't configured
  if (targetWeekdays.length === 0) {
    console.warn("⚠️ No valid posting days found - using all days of the month as fallback");
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      for (let i = 0; i < videosPerDay; i++) {
        result.push(parseTimeToDate(date, times[i]));
        if (result.length >= slotsNeeded) return result;
      }
    }
    return result.slice(0, slotsNeeded);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const weekday = date.getDay();

    if (!targetWeekdays.includes(weekday)) continue;

    // Bi-weekly: only even weeks (0, 2, etc.)
    if (postingSchedule === "bi-weekly") {
      const weekIndex = Math.floor((day - 1) / 7);
      if (weekIndex % 2 !== 0) continue;
    }

    for (let i = 0; i < videosPerDay; i++) {
      result.push(parseTimeToDate(date, times[i]));
      if (result.length >= slotsNeeded) return result;
    }
  }

  return result.slice(0, slotsNeeded);
}

// ─────────────────────────────────────────
// Main API Handler
// ─────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { clientId, year, month, dryRun, deliverableId } = body || {};

    const now = new Date();
    const targetYear = typeof year === "number" ? year : now.getFullYear();
    const targetMonth = typeof month === "number" ? month : now.getMonth();

    console.log(`🚀 Starting recurring task generation for ${targetYear}-${targetMonth + 1}${dryRun ? " (DRY RUN)" : ""}`);

    // 📁 NEW: Ensure Month Folders for all active clients
    // This runs every time the recurring cron runs (typically daily)
    const monthLabel = new Date(targetYear, targetMonth).toLocaleDateString("en-US", { month: "long" });
    const monthYearFolder = `${monthLabel}-${targetYear}`;


    console.log(`📂month folders: ${monthLabel}  ${monthYearFolder} `);

    const activeClients = await prisma.client.findMany({
      where: { status: "active" },
      select: { id: true, companyName: true, name: true, rawFootageFolderId: true },
    });

    console.log(`📂 Ensuring month folders for ${activeClients.length} clients for ${monthYearFolder}`);

    for (const client of activeClients) {
      const companyName = client.companyName || client.name;
      const rawFootageBase = client.rawFootageFolderId || `${companyName}/raw-footage/`;
      const base = rawFootageBase.endsWith("/") ? rawFootageBase : `${rawFootageBase}/`;
      const folderKey = `${base}${monthYearFolder}/`;

      console.log(` ${companyName} at ${folderKey}`);

      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: folderKey,
            ContentType: "application/x-directory",
          })
        );
      } catch (err) {
        console.log(`   ⚠️ Folder check failed for ${client.name} (usually OK):`, err);
      }
    }

    console.log(`🔄 Running recurring tasks for ${targetYear}-${targetMonth + 1}${dryRun ? " (DRY RUN)" : ""}`);

    // Find active recurring tasks
    const where: any = { active: true };
    if (clientId) where.clientId = clientId;
    if (deliverableId) where.deliverableId = deliverableId;

    console.log(`🔍 clientId, deliverableId:`, clientId, deliverableId);

    const recurringTasks = await prisma.recurringTask.findMany({
      where,
      include: {
        client: true,
        deliverable: true,
        templateTask: true,
      },
    });

    console.log(`📋 Found ${recurringTasks.length} active recurring tasks`);

    // Get a default admin/manager user for fallback assignment
    const defaultUser = await prisma.user.findFirst({
      where: { role: { in: ["admin", "manager"] }, employeeStatus: "ACTIVE" },
      select: { id: true },
    });

    if (!defaultUser) {
      return NextResponse.json(
        { success: false, message: "No active admin/manager found for task assignment" },
        { status: 400 }
      );
    }

    const createdTasks: any[] = [];
    const skipped: { clientName: string; reason: string }[] = [];

    for (const rt of recurringTasks) {
      try {
        const { client, deliverable } = rt;

        // Validate required data
        if (!deliverable) {
          skipped.push({ clientName: client.name, reason: "No deliverable" });
          continue;
        }

        // ─────────────────────────────────────────
        // DUPLICATE PREVENTION: Check if tasks already exist for this month
        //
        // Primary check: Match by recurringMonth label (e.g., "2026-03")
        // Fallback check: If recurringMonth is not set on existing tasks 
        // (legacy/initial batch), also check by dueDate range within the
        // target month. This prevents re-creating tasks that were created
        // by generateMonthlyTasksFromTemplate (which historically didn't  
        // set recurringMonth).
        // ─────────────────────────────────────────
        const recurringMonthLabel = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;

        // Primary: count tasks tagged with this recurringMonth
        const taggedTasks = await prisma.task.count({
          where: {
            clientId: rt.clientId,
            monthlyDeliverableId: deliverable.id,
            recurringMonth: recurringMonthLabel,
          },
        });

        // Fallback: count tasks with dueDate in this month but WITHOUT recurringMonth
        // (catches legacy tasks created before the recurringMonth fix)
        const monthStart = new Date(targetYear, targetMonth, 1);
        const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

        const untaggedTasks = await prisma.task.count({
          where: {
            clientId: rt.clientId,
            monthlyDeliverableId: deliverable.id,
            recurringMonth: null,
            dueDate: { gte: monthStart, lte: monthEnd },
          },
        });

        const existingTasksForMonth = taggedTasks + untaggedTasks;

        // 🔥 FIX: Also backfill recurringMonth on untagged tasks so future runs are clean
        if (untaggedTasks > 0) {
          console.log(`🏷️ Backfilling recurringMonth="${recurringMonthLabel}" on ${untaggedTasks} untagged tasks for ${client.name}`);
          await prisma.task.updateMany({
            where: {
              clientId: rt.clientId,
              monthlyDeliverableId: deliverable.id,
              recurringMonth: null,
              dueDate: { gte: monthStart, lte: monthEnd },
            },
            data: { recurringMonth: recurringMonthLabel },
          });
        }

        if (existingTasksForMonth >= deliverable.quantity) {
          skipped.push({
            clientName: client.name,
            reason: `Already has ${existingTasksForMonth}/${deliverable.quantity} tasks for this month`,
          });
          continue;
        }

        // ─────────────────────────────────────────
        // USE STORED MASTER TEMPLATE (from RecurringTask.templateTaskId)
        // ─────────────────────────────────────────
        const masterTemplate = rt.templateTask;

        if (!masterTemplate) {
          skipped.push({
            clientName: client.name,
            reason: "No master template found - create the first task manually for this deliverable",
          });
          continue;
        }

        console.log(`📋 Using master template: ${masterTemplate.title} for ${client.name}`);

        // ─────────────────────────────────────────
        // Create ALL tasks for this month (starting from #1)
        // ─────────────────────────────────────────
        const tasksToCreate = deliverable.quantity - existingTasksForMonth;
        const startIndex = existingTasksForMonth + 1;

        // ─────────────────────────────────────────
        // Generate posting dates for the target month
        // ─────────────────────────────────────────
        const dueDates = generatePostingDatesForMonth({
          year: targetYear,
          month: targetMonth,
          quantity: tasksToCreate,
          videosPerDay: deliverable.videosPerDay || 1,
          postingSchedule: deliverable.postingSchedule as PostingSchedule,
          postingDays: deliverable.postingDays || [],
          postingTimes: deliverable.postingTimes || ["10:00"],
        });

        if (dueDates.length === 0) {
          skipped.push({ clientName: client.name, reason: "No posting dates generated - check deliverable posting schedule" });
          continue;
        }

        // ─────────────────────────────────────────
        // Build task titles
        // ─────────────────────────────────────────
        const companyName = client.companyName || client.name;
        const clientSlug = companyName.replace(/\s+/g, "");  // Use companyName for task title
        const deliverableSlug = getDeliverableShortCode(deliverable.type);
        // Use 1st of target month so titles are consistent regardless of when the API runs
        const monthFirstDay = new Date(targetYear, targetMonth, 1);
        const createdDateStr = formatDateMMDDYYYY(monthFirstDay);

        for (let i = 0; i < dueDates.length; i++) {
          const dueDate = dueDates[i];
          const taskNumber = startIndex + i;

          // Build title with month-start date and incrementing number
          const title = `${clientSlug}_${createdDateStr}_${deliverableSlug}${taskNumber}`;

          if (dryRun) {
            // Dry run - just collect what would be created
            createdTasks.push({
              id: `dry-run-${i}`,
              title,
              dueDate,
              templateFrom: masterTemplate.title,
              assignedTo: masterTemplate.assignedTo,
              qc_specialist: masterTemplate.qc_specialist,
              scheduler: masterTemplate.scheduler,
              videographer: masterTemplate.videographer,
            });
            continue;
          }

          // Create S3 folder for this task (grouped by month)
          let outputFolderId: string | null = null;
          try {
            outputFolderId = await createTaskFolderStructure(companyName, title, monthYearFolder);
          } catch (error) {
            console.error(`⚠️ S3 folder creation failed for ${title}:`, error);
            // Continue without folder - don't block task creation
          }

          // Create the task - copy ALL fields from master template
          const newTask = await prisma.task.create({
            data: {
              title,
              // Copy everything from master template
              description: masterTemplate.description || "",
              taskType: masterTemplate.taskType || deliverable.type,
              status: "PENDING",
              dueDate,
              assignedTo: masterTemplate.assignedTo || defaultUser.id,
              createdBy: masterTemplate.createdBy,
              clientId: rt.clientId,
              clientUserId: client.userId,
              monthlyDeliverableId: deliverable.id,
              outputFolderId,
              // Tag which monthly cycle this task belongs to
              recurringMonth: recurringMonthLabel,
              // Copy all role assignments from master template
              qc_specialist: masterTemplate.qc_specialist,
              scheduler: masterTemplate.scheduler,
              videographer: masterTemplate.videographer,
              // Copy other fields from master template
              folderType: masterTemplate.folderType,
              driveLinks: masterTemplate.driveLinks ?? [],
              priority: masterTemplate.priority,
              taskCategory: masterTemplate.taskCategory,
              deliverableType: masterTemplate.deliverableType,
            },
          });

          createdTasks.push(newTask);
        }

        if (!dryRun) {
          // Update nextRunDate to next month
          const nextMonth = targetMonth === 11 ? 0 : targetMonth + 1;
          const nextYear = targetMonth === 11 ? targetYear + 1 : targetYear;

          await prisma.recurringTask.update({
            where: { id: rt.id },
            data: {
              lastRunDate: now,
              nextRunDate: new Date(nextYear, nextMonth, 1),
            },
          });
        }

        console.log(`✅ ${client.name}: ${dryRun ? "Would create" : "Created"} ${dueDates.length} tasks`);
      } catch (itemErr) {
        console.error(`❌ Failed processing recurring task for client:`, rt.clientId, itemErr);
        skipped.push({
          clientName: rt.client?.name || rt.clientId,
          reason: `Error: ${itemErr instanceof Error ? itemErr.message : String(itemErr)}`
        });
      }
    }

    console.log(`🎉 Completed: ${createdTasks.length} tasks ${dryRun ? "would be" : ""} created, ${skipped.length} skipped`);

    const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
    await createAuditLog({
      action: AuditAction.TASK_CREATED,
      entity: "RecurringTask",
      details: `Automated task generation complete: ${createdTasks.length} created, ${skipped.length} skipped`,
      metadata: {
        createdCount: createdTasks.length,
        skippedCount: skipped.length,
        targetMonth: `${targetYear}-${targetMonth + 1}`
      }
    });

    return NextResponse.json(
      {
        success: true,
        dryRun: !!dryRun,
        created: createdTasks.length,
        skipped: skipped.length,
        details: {
          tasks: createdTasks.map((t) => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            ...(dryRun ? { templateFrom: t.templateFrom, assignedTo: t.assignedTo } : {}),
          })),
          skippedReasons: skipped,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ POST /api/tasks/recurring/run error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to generate recurring tasks", error: String(err) },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────
// GET: Show recurring task status
// ─────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");

    const where: any = { active: true };
    if (clientId) where.clientId = clientId;

    const recurringTasks = await prisma.recurringTask.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        deliverable: { select: { id: true, type: true, quantity: true } },
        templateTask: { select: { id: true, title: true, assignedTo: true } },
      },
      orderBy: { nextRunDate: "asc" },
    });

    return NextResponse.json({
      success: true,
      count: recurringTasks.length,
      recurringTasks,
    });
  } catch (err) {
    console.error("❌ GET /api/tasks/recurring/run error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch recurring tasks" },
      { status: 500 }
    );
  }
}
