import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ─────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────

type PostingSchedule = "weekly" | "bi-weekly" | "monthly" | "custom";

const WEEKDAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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

async function createTaskFolderStructure(
  companyName: string,
  taskTitle: string
): Promise<string> {
  const taskFolderPath = `${companyName}/outputs/${taskTitle}/`;
  try {
    const folders = [
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
  while (times.length < videosPerDay) times.push(times[times.length - 1] || "10:00");

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
  if (targetWeekdays.length === 0) return [];

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
  try {
    const { id: clientId } = await params;

    if (!clientId) {
      return NextResponse.json({ error: "Missing client ID" }, { status: 400 });
    }

    const now = new Date();
    const targetYear = now.getFullYear();
    const targetMonth = now.getMonth();

    // Find active recurring tasks for this client
    const recurringTasks = await prisma.recurringTask.findMany({
      where: { clientId, active: true },
      include: {
        client: true,
        deliverable: true,
        templateTask: true,
      },
    });

    if (recurringTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active recurring tasks for this client",
        created: 0,
      });
    }

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

    for (const rt of recurringTasks) {
      const { client, deliverable, templateTask } = rt;

      if (!deliverable) continue;

      // Duplicate prevention
      const monthStart = new Date(targetYear, targetMonth, 1);
      const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

      const existingTasks = await prisma.task.count({
        where: {
          clientId,
          monthlyDeliverableId: deliverable.id,
          dueDate: { gte: monthStart, lte: monthEnd },
        },
      });

      if (existingTasks >= deliverable.quantity) continue;

      const tasksToCreate = deliverable.quantity - existingTasks;
      const dueDates = generatePostingDatesForMonth({
        year: targetYear,
        month: targetMonth,
        quantity: tasksToCreate,
        videosPerDay: deliverable.videosPerDay || 1,
        postingSchedule: deliverable.postingSchedule as PostingSchedule,
        postingDays: deliverable.postingDays || [],
        postingTimes: deliverable.postingTimes || ["10:00"],
      });

      if (dueDates.length === 0) continue;

      const companyName = client.companyName || client.name;
      const clientSlug = client.name.replace(/\s+/g, "");
      const deliverableSlug = getDeliverableShortCode(deliverable.type);
      const createdDateStr = formatDateMMDDYYYY(now);
      const startIndex = existingTasks + 1;

      for (let i = 0; i < dueDates.length; i++) {
        const taskNumber = startIndex + i;
        const title = `${clientSlug}_${createdDateStr}_${deliverableSlug}${taskNumber}`;

        let outputFolderId: string | null = null;
        try {
          outputFolderId = await createTaskFolderStructure(companyName, title);
        } catch (error) {
          console.error(`⚠️ S3 folder creation failed for ${title}`);
        }

        const newTask = await prisma.task.create({
          data: {
            title,
            description: templateTask?.description || "",
            taskType: templateTask?.taskType || deliverable.type,
            status: "PENDING",
            dueDate: dueDates[i],
            assignedTo: templateTask?.assignedTo || defaultUser.id,
            createdBy: templateTask?.createdBy,
            clientId,
            clientUserId: client.userId,
            monthlyDeliverableId: deliverable.id,
            outputFolderId,
            qc_specialist: templateTask?.qc_specialist,
            scheduler: templateTask?.scheduler,
            videographer: templateTask?.videographer,
            folderType: templateTask?.folderType,
            driveLinks: templateTask?.driveLinks ?? [],
          },
        });
        createdTasks.push(newTask);
      }

      // Update nextRunDate
      const nextMonth = targetMonth === 11 ? 0 : targetMonth + 1;
      const nextYear = targetMonth === 11 ? targetYear + 1 : targetYear;
      await prisma.recurringTask.update({
        where: { id: rt.id },
        data: { lastRunDate: now, nextRunDate: new Date(nextYear, nextMonth, 1) },
      });
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
