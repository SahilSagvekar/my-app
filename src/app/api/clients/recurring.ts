import { monthlyDeliverable, recurringTask } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq } from "drizzle-orm";

// Caller must pass either a live db instance (getDb()) or a transaction
// (tx) it's already inside — no module-level singleton fallback, since a
// shared Pool can't be held open across Cloudflare Worker requests.
export async function createRecurringTasksForClient(clientId: string, db: any) {
  const deliverables = await db.select().from(monthlyDeliverable).where(eq(monthlyDeliverable.clientId, clientId));

  if (!deliverables.length) return [];

  const tasks = deliverables.map((d) => {
    const nextRun = calculateNextRunDate(d);

    return db.insert(recurringTask).values({
      id: createId(),
      clientId,
      deliverableId: d.id,
      scheduleType: d.postingSchedule,
      nextRunDate: nextRun.toISOString(),
      active: true,
    }).returning();
  });

  return Promise.all(tasks);
}

function calculateNextRunDate(d: { postingSchedule: string }) {
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
