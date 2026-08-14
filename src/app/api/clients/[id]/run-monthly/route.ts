export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { recurringTask, task, user } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, eq, inArray, isNull, gte, lte, count } from "drizzle-orm";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3, BUCKET } from "@/lib/s3";

// ─────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────

type PostingSchedule = "weekly" | "bi-weekly" | "monthly" | "custom";

const WEEKDAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

const s3Client = getS3();

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

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
  if (normalized === "stories") return "ST";
  if (normalized === "text post") return "TP";
  return type.replace(/\s+/g, "");
}

function formatDateMMDDYYYY(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

function parseTimeToDate(base: Date, timeStr: string): Date {
  const d = new Date(base);
  // Try AM/PM format first (e.g., "10:00 AM", "2:30 PM")
  const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hh = parseInt(ampmMatch[1], 10);
    const mm = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (period === "PM" && hh !== 12) hh += 12;
    if (period === "AM" && hh === 12) hh = 0;
    d.setHours(hh, mm, 0, 0);
    return d;
  }
  // Fallback: 24h format (e.g., "10:00", "14:00")
  const [hh, mm] = timeStr.split(":").map(Number);
  d.setHours(hh, mm ?? 0, 0, 0);
  return d;
}

function parseDayOfMonthLabel(label: string): number | null {
  const match = label.match(/^(\d+)(st|nd|rd|th)$/i);
  if (!match) return null;
  return parseInt(match[1], 10);
}

async function createTaskFolderStructure(
  companyName: string,
  taskTitle: string,
  monthFolder: string
): Promise<string> {
  // Monthly grouped path: CompanyName/outputs/Month-Year/TaskTitle/
  const monthFolderPath = `${companyName}/outputs/${monthFolder}/`;
  const taskFolderPath = `${monthFolderPath}${taskTitle}/`;
  try {
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
            Bucket: BUCKET,
            Key: folder,
            ContentType: "application/x-directory",
          })
        )
      )
    );
    return taskFolderPath;
  } catch (error) {
    console.error("❌ Failed to create task folder:", error);
    throw error;
  }
}

function generatePostingDatesForMonth(opts: {
  year: number;
  month: number;
  quantity: number;
  videosPerDay: number;
  postingSchedule: PostingSchedule;
  postingDays: string[];
  postingTimes: string[];
}): Date[] {
  const { year, month, quantity, videosPerDay, postingSchedule, postingDays, postingTimes } = opts;
  const result: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const times = [...postingTimes];
  while (times.length < videosPerDay) times.push(times[times.length - 1] || "10:00 AM");

  const hasNumericDays = postingDays.some((d) => parseDayOfMonthLabel(d) !== null);
  if (postingSchedule === "monthly" && hasNumericDays) {
    for (const label of postingDays) {
      const dom = parseDayOfMonthLabel(label);
      if (!dom || dom > daysInMonth) continue;
      const baseDate = new Date(year, month, dom);
      for (let i = 0; i < videosPerDay; i++) {
        result.push(parseTimeToDate(baseDate, times[i]));
        if (result.length >= quantity) return result;
      }
    }
    return result.slice(0, quantity);
  }

  const targetWeekdays = postingDays.map((d) => WEEKDAY_MAP[d]).filter((v) => v !== undefined);

  // 🔥 FALLBACK: If no valid posting days, use ALL days of the month
  if (targetWeekdays.length === 0) {
    console.warn("⚠️ No valid posting days found - using all days of the month as fallback");
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      for (let i = 0; i < videosPerDay; i++) {
        result.push(parseTimeToDate(date, times[i]));
        if (result.length >= quantity) return result;
      }
    }
    return result.slice(0, quantity);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (!targetWeekdays.includes(date.getDay())) continue;
    if (postingSchedule === "bi-weekly" && Math.floor((day - 1) / 7) % 2 !== 0) continue;
    for (let i = 0; i < videosPerDay; i++) {
      result.push(parseTimeToDate(date, times[i]));
      if (result.length >= quantity) return result;
    }
  }
  return result.slice(0, quantity);
}

// ─────────────────────────────────────────
// POST: Run recurring tasks for specific client
// ─────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const { id: clientId } = await params;

    if (!clientId) {
      return NextResponse.json({ error: "Missing client ID" }, { status: 400 });
    }

    const now = new Date();
    const targetYear = now.getFullYear();
    const targetMonth = now.getMonth();

    // Find active recurring tasks for this client
    const rawRecurringTasks = await db.query.recurringTask.findMany({
      where: and(eq(recurringTask.clientId, clientId), eq(recurringTask.active, true)),
      with: {
        client: true,
        monthlyDeliverable: true,
        task: true,
      },
    });
    const recurringTasks = rawRecurringTasks.map(({ monthlyDeliverable, task: templateTask, ...rt }: any) => ({
      ...rt,
      deliverable: monthlyDeliverable,
      templateTask,
    }));

    if (recurringTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active recurring tasks for this client",
        created: 0,
      });
    }

    // Get a default admin/manager user for fallback assignment
    const [defaultUser] = await db.select({ id: user.id }).from(user)
      .where(and(inArray(user.role, ["admin", "manager"] as any), eq(user.employeeStatus, "ACTIVE")))
      .limit(1);

    if (!defaultUser) {
      return NextResponse.json(
        { success: false, message: "No active admin/manager found for task assignment" },
        { status: 400 }
      );
    }

    const createdTasks: any[] = [];

    for (const rt of recurringTasks) {
      const { client, deliverable, templateTask } = rt;

      if (!deliverable) continue;

      // Duplicate prevention using recurringMonth to identify cycle
      // + fallback check for legacy tasks without recurringMonth
      const recurringMonthLabel = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;

      // Primary: count tasks tagged with this recurringMonth
      const [{ value: taggedTasks }] = await db.select({ value: count() }).from(task).where(and(
        eq(task.clientId, clientId),
        eq(task.monthlyDeliverableId, deliverable.id),
        eq(task.recurringMonth, recurringMonthLabel),
      ));

      // Fallback: count tasks with dueDate in this month but WITHOUT recurringMonth
      const monthStart = new Date(targetYear, targetMonth, 1);
      const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

      const untaggedCondition = and(
        eq(task.clientId, clientId),
        eq(task.monthlyDeliverableId, deliverable.id),
        isNull(task.recurringMonth),
        gte(task.dueDate, monthStart.toISOString()),
        lte(task.dueDate, monthEnd.toISOString()),
      );
      const [{ value: untaggedTasks }] = await db.select({ value: count() }).from(task).where(untaggedCondition);

      const existingTasks = taggedTasks + untaggedTasks;

      // Backfill recurringMonth on untagged tasks
      if (untaggedTasks > 0) {
        console.log(`🏷️ Backfilling recurringMonth="${recurringMonthLabel}" on ${untaggedTasks} untagged tasks for ${client.name}`);
        await db.update(task).set({ recurringMonth: recurringMonthLabel, updatedAt: new Date().toISOString() }).where(untaggedCondition);
      }

      if (existingTasks >= deliverable.quantity) continue;

      const tasksToCreate = deliverable.quantity - existingTasks;
      const dueDates = generatePostingDatesForMonth({
        year: targetYear,
        month: targetMonth,
        quantity: tasksToCreate,
        videosPerDay: deliverable.videosPerDay || 1,
        postingSchedule: deliverable.postingSchedule as PostingSchedule,
        postingDays: deliverable.postingDays || [],
        postingTimes: deliverable.postingTimes || ["10:00 AM"],
      });

      if (dueDates.length === 0) continue;

      const companyName = client.companyName || client.name;
      const clientSlug = client.name.replace(/\s+/g, "");
      const deliverableSlug = getDeliverableShortCode(deliverable.type);
      // Use 1st of target month so titles are consistent regardless of when the API runs
      const monthFirstDay = new Date(targetYear, targetMonth, 1);
      const createdDateStr = formatDateMMDDYYYY(monthFirstDay);
      const startIndex = existingTasks + 1;

      // Monthly folder for task grouping
      const monthLabel = new Date(targetYear, targetMonth).toLocaleDateString("en-US", { month: "long" });
      const monthYearFolder = `${monthLabel}-${targetYear}`;

      for (let i = 0; i < dueDates.length; i++) {
        const taskNumber = startIndex + i;
        const title = `${companyName}_${createdDateStr}_${deliverableSlug}${taskNumber}`;

        let outputFolderId: string | null = null;
        try {
          outputFolderId = await createTaskFolderStructure(companyName, title, monthYearFolder);
        } catch (error) {
          console.error(`⚠️ S3 folder creation failed for ${title}`);
        }

        const [newTask] = await db.insert(task).values({
          id: createId(),
          title,
          description: templateTask?.description || "",
          taskType: templateTask?.taskType || deliverable.type,
          status: "PENDING",
          dueDate: dueDates[i].toISOString(),
          assignedTo: templateTask?.assignedTo || defaultUser.id,
          createdBy: templateTask?.createdBy,
          clientId,
          clientUserId: client.userId,
          monthlyDeliverableId: deliverable.id,
          outputFolderId,
          monthFolder: monthYearFolder,
          recurringMonth: recurringMonthLabel,
          qcSpecialist: templateTask?.qcSpecialist,
          scheduler: templateTask?.scheduler,
          videographer: templateTask?.videographer,
          folderType: templateTask?.folderType,
          driveLinks: templateTask?.driveLinks ?? [],
          isTrial: deliverable.isTrial ?? client.isTrial ?? false,
          updatedAt: new Date().toISOString(),
        }).returning();
        createdTasks.push(newTask);
      }

      // Update nextRunDate
      const nextMonth = targetMonth === 11 ? 0 : targetMonth + 1;
      const nextYear = targetMonth === 11 ? targetYear + 1 : targetYear;
      await db.update(recurringTask).set({
        lastRunDate: now.toISOString(),
        nextRunDate: new Date(nextYear, nextMonth, 1).toISOString(),
      }).where(eq(recurringTask.id, rt.id));
    }

    return NextResponse.json({
      success: true,
      created: createdTasks.length,
      tasks: createdTasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate })),
    });
  } catch (err) {
    console.error("❌ POST /api/clients/[id]/run-monthly error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to run monthly recurring", error: String(err) },
      { status: 500 }
    );
  }
}