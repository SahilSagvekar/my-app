import { getDbHttp } from "@/lib/db";
import { task as taskTable } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";
import { EditorDashboard } from "@/components/dashboards/EditorDashboard";

export const dynamic = 'force-dynamic';

export default async function EditorPage() {
  const db = getDbHttp();
  const user = await getCurrentUser2();
  if (!user) return <div className="p-6">Unauthorized</div>;

  // SCHEMA DRIFT (flagged prominently in migration report): the original
  // select included `type`, `assignedToName`, `assignedToRole`, `projectId`,
  // `parentTaskId`, `rejectionReason`, `originalTaskId` — NONE of these are
  // real columns on Task, in either prisma/schema.prisma or the live DB
  // (verified via grep of both). This select would have thrown a Prisma
  // validation error at runtime if this code path was ever actually hit.
  // It likely never was: `EditorDashboard` (src/components/dashboards/
  // EditorDashboard.tsx) is declared as `export function EditorDashboard()`
  // with NO props at all, so the `initialTasks` prop passed below has always
  // been silently discarded — this whole query's result is unused. Dropped
  // the nonexistent fields per hard rule 7; kept only real Task columns plus
  // the real `files` relation.
  const tasks = await db.query.task.findMany({
    where: eq(taskTable.assignedTo, user.userId),
    orderBy: desc(taskTable.createdAt),
    columns: {
      id: true, title: true, description: true, status: true,
      assignedTo: true, createdAt: true, dueDate: true, workflowStep: true,
      feedback: true,
    },
    with: { files: true },
  });

  return <EditorDashboard initialTasks={tasks} />;
}
