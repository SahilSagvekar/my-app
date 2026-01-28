// import { prisma } from "@/lib/prisma";
// import { createTaskOutputFolder } from "@/lib/s3";
// import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// const s3Client = new S3Client({
//   region: process.env.AWS_S3_REGION!,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// });

// function getDeliverableShortCode(type: string) {
//   const normalized = type.toLowerCase().trim();

//   console.log("Normalized deliverable type:", normalized);

//   if (normalized === "short form videos") return "SF";
//   if (normalized === "long form videos") return "LF";
//   if (normalized === "square form videos") return "SQF";
//   if (normalized === "thumbnails") return "THUMB";
//   if (normalized === "tiles") return "T";
//   if (normalized === "hard posts / graphic images") return "HP";
//   if (normalized === "snapchat episodes") return "SEP";
//   if (normalized === "beta short form") return "BSF";
//   // fallback: original slug behavior
//   return type.replace(/\s+/g, "");
// }

// function formatDateMMDDYYYY(date: Date) {
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const day = String(date.getDate()).padStart(2, "0");
//   const year = date.getFullYear();
//   return `${month}-${day}-${year}`;
// }

// // 🔥 NEW: Create task folder structure in S3
// async function createTaskFolderStructure(
//   companyName: string,
//   taskTitle: string
// ): Promise<string> {
//   try {
//     // Main task folder: CompanyName/outputs/TaskTitle/
//     const taskFolderPath = `${companyName}/outputs/${taskTitle}/`;

//     // Create main task folder
//     await s3Client.send(
//       new PutObjectCommand({
//         Bucket: process.env.AWS_S3_BUCKET!,
//         Key: taskFolderPath,
//         ContentType: "application/x-directory",
//       })
//     );

//     // 🔥 Create ONLY special subfolders (NO "task" folder!)
//     await s3Client.send(
//       new PutObjectCommand({
//         Bucket: process.env.AWS_S3_BUCKET!,
//         Key: `${taskFolderPath}thumbnails/`,
//         ContentType: "application/x-directory",
//       })
//     );

//     await s3Client.send(
//       new PutObjectCommand({
//         Bucket: process.env.AWS_S3_BUCKET!,
//         Key: `${taskFolderPath}tiles/`,
//         ContentType: "application/x-directory",
//       })
//     );

//     await s3Client.send(
//       new PutObjectCommand({
//         Bucket: process.env.AWS_S3_BUCKET!,
//         Key: `${taskFolderPath}music-license/`,
//         ContentType: "application/x-directory",
//       })
//     );

//     console.log("✅ Task folder structure created:", {
//       main: taskFolderPath,
//       thumbnails: `${taskFolderPath}thumbnails/`,
//       tiles: `${taskFolderPath}tiles/`,
//       musicLicense: `${taskFolderPath}music-license/`,
//     });

//     return taskFolderPath;
//   } catch (error) {
//     console.error("❌ Failed to create task folder structure:", error);
//     throw error;
//   }
// }

// export async function generateMonthlyTasksFromTemplate(
//   taskId: string,
//   monthlyDeliverableId?: string
// ) {
//   // STEP 1 — Fetch template task
//   const templateTask = await prisma.task.findUnique({
//     where: { id: taskId },
//   });

//   console.log("Template task fetched:", templateTask);

//   if (!templateTask || !templateTask.clientId || !templateTask.dueDate) {
//     return { created: 0, error: "Invalid template task" };
//   }

//   const clientId = templateTask.clientId;

//   console.log("clientId:", clientId);

//   // STEP 2 — Fetch client + deliverable
//   const client = await prisma.client.findUnique({
//     where: { id: clientId },
//     include: { monthlyDeliverables: true },
//   });

//   console.log("Client:", client);

//   const deliverable = await prisma.monthlyDeliverable.findFirst({
//     where: {
//       id: monthlyDeliverableId,
//       clientId: clientId,
//     },
//   });

//   console.log("deliverable:", deliverable);

//   if (!deliverable) {
//     console.error("❌ Deliverable not found for ID:", monthlyDeliverableId);
//     return { created: 0, error: "Deliverable not found" };
//   }

//   if (!client || !client.monthlyDeliverables.length) {
//     return { created: 0, error: "No deliverable found" };
//   }

//   const quantity = deliverable.quantity ?? 1;

//   console.log("Quantity:", quantity);

//   // STEP 3 — Month boundaries
//   const firstDate = new Date(templateTask.dueDate);
//   const monthEnd = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);

//   // STEP 4 — Build posting date list (ALL days from firstDate to month end)
//   const dates: Date[] = [];
//   const cursor = new Date(firstDate);

//   while (cursor <= monthEnd) {
//     dates.push(new Date(cursor));
//     cursor.setDate(cursor.getDate() + 1);
//   }

//   // Calculate tasks per day to spread evenly
//   const daysAvailable = dates.length;
//   const tasksPerDay = Math.ceil(quantity / daysAvailable);

//   console.log("=== DEBUG INFO ===");
//   console.log("quantity:", quantity);
//   console.log("daysAvailable:", daysAvailable);
//   console.log("tasksPerDay:", tasksPerDay);
//   console.log("firstDate:", firstDate.toDateString());
//   console.log("monthEnd:", monthEnd.toDateString());
//   console.log("==================");

//   // STEP 5 — Naming parts
//   const companyName = client?.companyName || client.name;
//   const companyNameSlug = (client?.companyName || client.name).replace(/\s/g, "");
//   const deliverableSlug = getDeliverableShortCode(deliverable.type);
//   const createdAtStr = formatDateMMDDYYYY(templateTask.createdAt);

//   // STEP 6 — Update template task with title and folder
//   let count = 1;
//   const title1 = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${count}`;

//   // 🔥 Create folder structure for template task
//   const taskFolderPath1 = await createTaskFolderStructure(companyName, title1);

//   await prisma.task.update({
//     where: { id: taskId },
//     data: {
//       title: title1,
//       outputFolderId: taskFolderPath1,
//     },
//   });

//   // ─────────────────────────────────────────
//   // Set this task as the master template for RecurringTask
//   // ─────────────────────────────────────────
//   const recurring = await prisma.recurringTask.updateMany({
//     where: {
//       clientId: clientId,
//       deliverableId: deliverable.id,
//       templateTaskId: null,
//     },
//     data: {
//       templateTaskId: taskId,
//     },
//   });

//   console.log(`✅ recurring`, recurring);

//   // STEP 7 — Create remaining tasks
//   const creates = [];

//   for (const date of dates) {
//     for (let i = 0; i < tasksPerDay; i++) {
//       // Skip the first slot of the first date (template task already exists)
//       if (date.toDateString() === firstDate.toDateString() && i === 0) {
//         continue;
//       }

//       if (count >= quantity) break;

//       count++;
//       const title = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${count}`;

//       // 🔥 Create folder structure for this task
//       const taskFolderPath = await createTaskFolderStructure(companyName, title);

//       creates.push(
//         prisma.task.create({
//           data: {
//             title,
//             description: templateTask.description,
//             taskType: templateTask.taskType,
//             status: "PENDING",
//             dueDate: date,
//             outputFolderId: taskFolderPath,
//             clientId: clientId,
//             clientUserId: client?.userId,
//             assignedTo: templateTask.assignedTo,
//             createdBy: templateTask.createdBy,
//             scheduler: templateTask.scheduler,
//             videographer: templateTask.videographer,
//             qc_specialist: templateTask.qc_specialist,
//             monthlyDeliverableId: templateTask.monthlyDeliverableId,
//           },
//         })
//       );
//     }
//     if (count >= quantity) break;
//   }

//   await Promise.all(creates);

//   console.log(`✅ Created ${creates.length} tasks with folder structures`);

//   return { created: creates.length };
// }

import { prisma } from "@/lib/prisma";
import { createTaskOutputFolder } from "@/lib/s3";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

function getDeliverableShortCode(type: string) {
  const normalized = type.toLowerCase().trim();

  console.log("Normalized deliverable type:", normalized);

  if (normalized === "short form videos") return "SF";
  if (normalized === "long form videos") return "LF";
  if (normalized === "square form videos") return "SQF";
  if (normalized === "thumbnails") return "THUMB";
  if (normalized === "tiles") return "T";
  if (normalized === "hard posts / graphic images") return "HP";
  if (normalized === "snapchat episodes") return "SEP";
  if (normalized === "beta short form") return "BSF";
  // fallback: original slug behavior
  return type.replace(/\s+/g, "");
}

// function formatDateYYYYMMDD(date: Date) {
//   const year = date.getFullYear();
//   const month = String(date.getMonth() + 1).padStart(2, "0");
//   const day = String(date.getDate()).padStart(2, "0");
//   return `${year}-${month}-${day}`;
// }

function formatDateMMDDYYYY(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}


// 🔥 NEW: Create task folder structure in S3
async function createTaskFolderStructure(
  companyName: string,
  taskTitle: string
): Promise<string> {
  try {
    // Main task folder: CompanyName/outputs/TaskTitle/
    const taskFolderPath = `${companyName}/outputs/${taskTitle}/`;

    // Create main task folder
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: taskFolderPath,
        ContentType: "application/x-directory",
      })
    );

    // 🔥 Create ONLY special subfolders (NO "task" folder!)
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: `${taskFolderPath}thumbnails/`,
        ContentType: "application/x-directory",
      })
    );

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: `${taskFolderPath}tiles/`,
        ContentType: "application/x-directory",
      })
    );

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: `${taskFolderPath}music-license/`,
        ContentType: "application/x-directory",
      })
    );

    console.log("✅ Task folder structure created:", {
      main: taskFolderPath,
      thumbnails: `${taskFolderPath}thumbnails/`,
      tiles: `${taskFolderPath}tiles/`,
      musicLicense: `${taskFolderPath}music-license/`,
    });

    return taskFolderPath;
  } catch (error) {
    console.error("❌ Failed to create task folder structure:", error);
    throw error;
  }
}

export async function generateMonthlyTasksFromTemplate(taskId: string, monthlyDeliverableId?: string) {
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

  const deliverable = await prisma.monthlyDeliverable.findFirst({
    where: {
      id: monthlyDeliverableId,
      clientId: clientId,
    },
  });

  if (!deliverable) {
    console.error("❌ Deliverable not found for ID:", monthlyDeliverableId);
    return { created: 0, error: "Deliverable not found" };
  }

  if (!client || !client.monthlyDeliverables.length) {
    return { created: 0, error: "No deliverable found" };
  }

  const quantity = deliverable.quantity ?? 1;
  const videosPerDay = deliverable.videosPerDay ?? 1;
  const postingDays = deliverable.postingDays ?? [];

  // STEP 3 — Month boundaries (start from template task's due date)
  const firstDate = new Date(templateTask.dueDate);
  const monthEnd = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);

  const WEEKDAY: Record<string, number> = {
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
  // 🔥 FIX: Start from firstDate (template's due date), not monthStart
  // 🔥 FIX: If postingDays is empty, use ALL days
  const dates: Date[] = [];
  const cursor = new Date(firstDate);

  while (cursor <= monthEnd) {
    // If no specific posting days configured, use ALL days
    if (validDays.length === 0 || validDays.includes(cursor.getDay())) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  // 🔥 DEBUG LOGGING
  console.log("=== TASK GENERATION DEBUG ===");
  console.log("quantity:", quantity);
  console.log("videosPerDay:", videosPerDay);
  console.log("postingDays:", postingDays);
  console.log("validDays (weekday numbers):", validDays);
  console.log("firstDate:", firstDate.toDateString());
  console.log("monthEnd:", monthEnd.toDateString());
  console.log("dates array length:", dates.length);
  console.log("dates sample:", dates.slice(0, 5).map(d => d.toDateString()));

  // 🔥 SAFEGUARD: If no dates, use all remaining days in month
  if (dates.length === 0) {
    console.warn("⚠️ No valid posting dates found! Using all remaining days.");
    const fallbackCursor = new Date(firstDate);
    while (fallbackCursor <= monthEnd) {
      dates.push(new Date(fallbackCursor));
      fallbackCursor.setDate(fallbackCursor.getDate() + 1);
    }
  }

  // Calculate tasks per day to spread evenly
  const daysAvailable = dates.length;
  const tasksPerDay = Math.max(1, Math.ceil(quantity / daysAvailable));

  console.log("daysAvailable:", daysAvailable);
  console.log("calculated tasksPerDay:", tasksPerDay);
  console.log("=============================");

  // STEP 5 — Naming parts
  const companyName = client?.companyName || client.name;
  const companyNameSlug = (client?.companyName || client.name).replace(/\s/g, '');
  const deliverableSlug = getDeliverableShortCode(deliverable.type);
  const createdAtStr = formatDateMMDDYYYY(templateTask.createdAt);

  // STEP 6 — Update template task with title and folder (Task #1)
  let count = 1;
  const title1 = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${count}`;

  // 🔥 Create folder structure for template task
  const taskFolderPath1 = await createTaskFolderStructure(companyName, title1);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title: title1,
      outputFolderId: taskFolderPath1,
    },
  });

  // ─────────────────────────────────────────
  // 🔥 ENSURE RECURRING TASK TRACKER IS UPDATED
  // ─────────────────────────────────────────
  const existingRecurring = await prisma.recurringTask.findFirst({
    where: {
      clientId: clientId,
      deliverableId: deliverable.id,
    },
  });

  if (existingRecurring) {
    await prisma.recurringTask.update({
      where: { id: existingRecurring.id },
      data: {
        templateTaskId: taskId, // Update to the newest blueprint
      },
    });
    console.log(`✅ Updated existing RecurringTask ${existingRecurring.id} with new template ${taskId}`);
  } else {
    // Determine next month's start for the tracker
    const now = new Date();
    const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
    const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    const nextRunDate = new Date(nextYear, nextMonth, 1);

    const newRecurring = await prisma.recurringTask.create({
      data: {
        clientId: clientId,
        deliverableId: deliverable.id,
        templateTaskId: taskId,
        active: true,
        nextRunDate: nextRunDate,
        scheduleType: deliverable.postingSchedule || "monthly",
      },
    });
    console.log(`✅ Created NEW RecurringTask ${newRecurring.id} for deliverable ${deliverable.id}`);
  }
  console.log(`✅ Template task (#1) updated: ${title1}`);

  // STEP 7 — Create remaining tasks (starting from #2)
  const creates = [];
  let dateIndex = 0;
  let daySlot = 1; // Start at slot 1 because template took slot 0

  // 🔥 FIX: Loop until we have created all tasks (quantity - 1, since template is task #1)
  while (count < quantity && dateIndex < dates.length) {
    const date = dates[dateIndex];

    // Create tasks for remaining slots on this day
    while (daySlot < tasksPerDay && count < quantity) {
      count++;
      const title = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${count}`;

      // Create folder structure for this task
      const taskFolderPath = await createTaskFolderStructure(companyName, title);

      creates.push(
        prisma.task.create({
          data: {
            title,
            description: templateTask.description,
            taskType: templateTask.taskType,
            status: "PENDING",
            dueDate: date,
            outputFolderId: taskFolderPath,
            clientId: clientId,
            clientUserId: client?.userId,
            assignedTo: templateTask.assignedTo,
            createdBy: templateTask.createdBy,
            scheduler: templateTask.scheduler,
            videographer: templateTask.videographer,
            qc_specialist: templateTask.qc_specialist,
            monthlyDeliverableId: templateTask.monthlyDeliverableId,
          },
        })
      );

      console.log(`   📝 Queued task #${count}: ${title} (Due: ${date.toDateString()})`);
      daySlot++;
    }

    // Move to next day
    dateIndex++;
    daySlot = 0; // Reset slot counter for new day
  }

  // Execute all creates
  if (creates.length > 0) {
    await Promise.all(creates);
  }

  console.log(`✅ Created ${creates.length} additional tasks (Total: ${count} tasks)`);

  // 📝 LOG THE SUCCESSFUL RUN
  try {
    const runDate = new Date(templateTask.dueDate);
    await prisma.monthlyRun.create({
      data: {
        clientId: clientId,
        month: runDate.getMonth() + 1, // 1-based month
        year: runDate.getFullYear(),
        runAt: new Date(),
      },
    });
    console.log(`📊 Logged MonthlyRun for ${clientId} (${runDate.getMonth() + 1}/${runDate.getFullYear()})`);
  } catch (error) {
    console.error("⚠️ Failed to log MonthlyRun:", error);
  }

  return { created: creates.length };
}
