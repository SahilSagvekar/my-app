import { prisma } from "@/lib/prisma";
import { generateMonthlyTasksFromTemplate } from "./generateMonthly";

export async function runMonthlyRecurringForClient(clientId: string) {
  const now = new Date();
  const month = now.getMonth();     // 0–11
  const year = now.getFullYear();

  // Check if this month's generation already happened
  const exists = await prisma.monthlyRun.findFirst({
    where: { clientId, month, year }
  });

  if (exists) {
    return { alreadyRan: true };
  }

  // Generate tasks for this month
  const result = await generateMonthlyTasksFromTemplate(clientId);

  // Log that we've run it
  await prisma.monthlyRun.create({
    data: { clientId, month, year }
  });

  return {
    alreadyRan: false,
    ...result
  };
}
