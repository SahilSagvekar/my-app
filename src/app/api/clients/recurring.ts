import { prisma } from "@/lib/prisma";

export async function createRecurringTasksForClient(clientId: string) {
  const deliverables = await prisma.monthlyDeliverable.findMany({
    where: { clientId },
  });

  const tasks = deliverables.map((d) => {
    const nextRun = calculateNextRunDate(d);
    return prisma.recurringTask.create({
      data: {
        clientId,
        deliverableId: d.id,
        scheduleType: d.postingSchedule,
        nextRunDate: nextRun,
        active: true,
      },
    });
  });

  await Promise.all(tasks);
}

function calculateNextRunDate(d: any) {
  const now = new Date();

  if (d.postingSchedule === "weekly") {
    return addDays(now, 7);
  }
  if (d.postingSchedule === "bi-weekly") {
    return addDays(now, 14);
  }
  if (d.postingSchedule === "monthly") {
    return addDays(now, 30);
  }

  // CUSTOM → first posting day next week
  return addDays(now, 5);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
