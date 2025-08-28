import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { EditorDashboard } from "@/components/dashboards/EditorDashboard";

export default async function EditorPage() {
  const user = await getCurrentUser2();
  if (!user) return <div className="p-6">Unauthorized</div>;

  const tasks = await prisma.task.findMany({
    where: { assignedTo: user.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, description: true, type: true, status: true,
      assignedTo: true, assignedToName: true, assignedToRole: true,
      createdAt: true, dueDate: true, workflowStep: true, projectId: true,
      parentTaskId: true, files: true, feedback: true, rejectionReason: true,
      originalTaskId: true,
    },
  });

  return <EditorDashboard initialTasks={tasks} />;
}
