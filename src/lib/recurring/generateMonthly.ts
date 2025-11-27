import { prisma } from "@/lib/prisma";

export async function generateMonthlyTasksFromTemplate(taskId: string) {
  // STEP 1 — Fetch template task
  const templateTask = await prisma.task.findUnique({
    where: { id: taskId },
  });

  if (!templateTask || !templateTask.clientId || !templateTask.dueDate) {
    return { created: 0, error: "Invalid template task" };
  }

  const clientId = templateTask.clientId;

  // STEP 2 — Fetch client + deliverable
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

  // STEP 3 — Month boundaries
  const firstDate = new Date(templateTask.dueDate);
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

  // STEP 4 — Build posting date list
  const dates: Date[] = [];
  const cursor = new Date(monthStart);

  while (cursor <= monthEnd) {
    if (validDays.includes(cursor.getDay())) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // STEP 5 — Naming parts
  const clientSlug = client.name.replace(/\s+/g, "");
  const deliverableSlug = deliverable.type.replace(/\s+/g, "");
  const createdAtStr = templateTask.createdAt.toISOString().slice(0, 10);

  // STEP 6 — Create remaining tasks
  const creates = [];
  let count = 0; // template task = #1

  for (const date of dates) {
    for (let i = 0; i < videosPerDay; i++) {
      if (count >= quantity) break;

      // Skip only the FIRST slot of the FIRST posting date
      if (date.toDateString() === firstDate.toDateString() && count === 1) {
        count++;
        continue;
      }

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

            // Copy assignments
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
