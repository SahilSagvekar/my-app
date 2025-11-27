import { prisma } from "@/lib/prisma";

export async function generateMonthlyTasksFromTemplate(taskId: string) {
  // STEP 1 — Fetch the template task
  const templateTask = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!templateTask || !templateTask.clientId || !templateTask.dueDate) {
    return { created: 0, error: "Invalid template task" };
  }

  const clientId = templateTask.clientId;

  // STEP 2 — Fetch the client + deliverable
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { monthlyDeliverables: true },
  });

  if (!client || !client.monthlyDeliverables.length) {
    return { created: 0, error: "No deliverable found" };
  }

  const deliverable = client.monthlyDeliverables[0];

  const quantity = deliverable.quantity ?? 1;
  const videosPerDay = deliverable.videosPerDay ?? 1;
  const postingDays = deliverable.postingDays ?? [];

  // Step 3 — Month boundaries
  const firstDate = new Date(templateTask.dueDate); // Option A
  const now = new Date();
  const monthStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
  const monthEnd = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);

  const WEEKDAY = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const validDays = postingDays
    .map((d) => WEEKDAY[d as keyof typeof WEEKDAY])
    .filter((v) => v !== undefined);

  // STEP 4 — Get all posting dates
  const allPostingDates: Date[] = [];
  const cursor = new Date(monthStart);

  while (cursor <= monthEnd) {
    if (validDays.includes(cursor.getDay())) {
      allPostingDates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // STEP 5 — Count how many were already created
  // Your template task is #1
  let count = 1;

  const clientSlug = client.name.replace(/\s+/g, "");
  const deliverableSlug = deliverable.type.replace(/\s+/g, "");
  const createdAtStr = templateTask.createdAt?.toISOString().slice(0, 10) ?? now.toISOString().slice(0, 10);

  // STEP 6 — Create remaining tasks
  const creates = [];

  for (const date of allPostingDates) {
    for (let v = 0; v < videosPerDay; v++) {
      if (count >= quantity) break;

      // Skip the date that matches the user's first task
      if (date.getTime() === firstDate.getTime()) continue;

      count++;
      const title = `${clientSlug}_${createdAtStr}_${deliverableSlug}_${count}`;

      creates.push(
        prisma.task.create({
          data: {
            title,
            description: templateTask.description,
            taskType: templateTask.taskType,
            status: "PENDING",
            dueDate: date,
            clientId,

            // Copy ALL assignments from the first task
            assignedTo: templateTask.assignedTo,
            createdBy: templateTask.createdBy,
            scheduler: templateTask.scheduler,
            videographer: templateTask.videographer,
            qc_specialist: templateTask.qc_specialist,
          },
        })
      );
    }
  }

  await Promise.all(creates);

  return { created: creates.length };
}
