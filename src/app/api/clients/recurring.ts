import { prisma } from "@/lib/prisma";

export async function createRecurringTasksForClient(clientId: string) {
  const deliverables = await prisma.monthlyDeliverable.findMany({
    where: { clientId },
  });

  if (!deliverables.length) return [];

  const tasks = deliverables.map((d) => {
    const nextRun = calculateNextRunDate(d);

    return prisma.recurringTask.create({
      data: {
        // MUST CONNECT — Required by Prisma schema
        client: {
          connect: { id: clientId }
        },
        deliverable: {
          connect: { id: d.id }
        },

        scheduleType: d.postingSchedule,
        nextRunDate: nextRun,
        active: true,
      },
    });
  });

  return Promise.all(tasks);
}

function calculateNextRunDate(d: any) {
  const now = new Date();

  switch (d.postingSchedule) {
    case "weekly":
      return addDays(now, 7);
    case "bi-weekly":
      return addDays(now, 14);
    case "monthly":
      return addDays(now, 30);
    default:
      // CUSTOM logic
      return addDays(now, 5);
  }
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
