import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildTaskTitle } from "@/lib/taskNaming";



type PostingSchedule = "weekly" | "bi-weekly" | "monthly" | "custom";

const WEEKDAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

// helper: parse "10:00" -> { hours: 10, minutes: 0 }
function parseTimeToDate(base: Date, timeStr: string): Date {
  const [hh, mm] = timeStr.split(":").map(Number);
  const d = new Date(base);
  d.setHours(hh, mm ?? 0, 0, 0);
  return d;
}

// helper: is postingDay a "1st", "15th", etc.
function parseDayOfMonthLabel(label: string): number | null {
  const match = label.match(/^(\d+)(st|nd|rd|th)$/i);
  if (!match) return null;
  return parseInt(match[1], 10);
}

// Build all posting dates for this month based on deliverable config
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
  const slotsNeeded = quantity; // 1 task per video

  // Normalize times: ensure length >= videosPerDay
  const times = [...postingTimes];
  while (times.length < videosPerDay) {
    times.push(times[times.length - 1] || "10:00");
  }

  const hasNumericDays = postingDays.some((d) => parseDayOfMonthLabel(d) !== null);

  if (postingSchedule === "monthly" && hasNumericDays) {
    // e.g. postingDays = ["1st", "15th"]
    for (const label of postingDays) {
      const dom = parseDayOfMonthLabel(label);
      if (!dom) continue;
      if (dom > daysInMonth) continue;

      const baseDate = new Date(year, month, dom);
      for (let i = 0; i < videosPerDay; i++) {
        result.push(parseTimeToDate(baseDate, times[i]));
        if (result.length >= slotsNeeded) return result;
      }
    }
    return result.slice(0, slotsNeeded);
  }

  // WEEKLY / BI-WEEKLY / CUSTOM using weekday names
  const targetWeekdays = postingDays
    .map((d) => WEEKDAY_MAP[d])
    .filter((v) => v !== undefined);

  if (targetWeekdays.length === 0) {
    return [];
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const weekday = date.getDay();

    if (!targetWeekdays.includes(weekday)) continue;

    // For bi-weekly: only even weeks in month (week index 0,1,2,3)
    if (postingSchedule === "bi-weekly") {
      const weekIndex = Math.floor((day - 1) / 7);
      if (weekIndex % 2 !== 0) continue;
    }

    // For "custom" we still honor postingDays but no extra constraints yet
    // (you can expand this later if needed)

    // Create a slot per video for that day
    for (let i = 0; i < videosPerDay; i++) {
      result.push(parseTimeToDate(date, times[i]));
      if (result.length >= slotsNeeded) return result;
    }
  }

  return result.slice(0, slotsNeeded);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { clientId, year, month } = body || {};

    const now = new Date();
    const targetYear = typeof year === "number" ? year : now.getFullYear();
    const targetMonth = typeof month === "number" ? month : now.getMonth(); // 0-based

    const where: any = { active: true };
    if (clientId) where.clientId = clientId;

    const recurring = await prisma.recurringTask.findMany({
      where,
      include: {
        client: true,
        deliverable: true,
        templateTask: true,
      },
    });

    const createdTasks = [];

    for (const rt of recurring) {
      const d = rt.deliverable;
      const template = rt.templateTask;

      if (!d || !template) continue;

      const quantity = d.quantity;
      const videosPerDay = d.videosPerDay || 1;
      const postingSchedule = d.postingSchedule as PostingSchedule;
      const postingDays = d.postingDays || [];
      const postingTimes = d.postingTimes || ["10:00"];

      const dueDates = generatePostingDatesForMonth({
        year: targetYear,
        month: targetMonth,
        quantity,
        videosPerDay,
        postingSchedule,
        postingDays,
        postingTimes,
      });

      let index = 0;
      for (const dueDate of dueDates) {
        const n = index + 1;

        const title =
          template.title.replace("{{n}}", String(n)) ||
          `${d.type} #${n} - ${rt.client.name}`;

        const newTask = await prisma.task.create({
          data: {
            title,
            description: template.description,
            taskType: template.taskType,
            status: "PENDING",
            dueDate,
            assignedTo: template.assignedTo,
            createdBy: template.createdBy,
            clientId: rt.clientId,
            driveFolderId: template.driveFolderId ?? null,
            attachments: template.attachments ?? undefined,
            driveLinks: template.driveLinks ?? [],
            folderType: template.folderType ?? null,
          },
        });

        createdTasks.push(newTask);
        index++;
      }

      // move nextRunDate to next month (you can adjust this logic)
      const nextMonth = targetMonth === 11 ? 0 : targetMonth + 1;
      const nextYear = targetMonth === 11 ? targetYear + 1 : targetYear;

      await prisma.recurringTask.update({
        where: { id: rt.id },
        data: {
          lastRunDate: new Date(),
          nextRunDate: new Date(nextYear, nextMonth, 1),
        },
      });
    }

    return NextResponse.json(
      { success: true, count: createdTasks.length, tasks: createdTasks },
      { status: 200 },
    );
  } catch (err) {
    console.error("❌ POST /recurring/run error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to generate recurring tasks" },
      { status: 500 },
    );
  }
}
