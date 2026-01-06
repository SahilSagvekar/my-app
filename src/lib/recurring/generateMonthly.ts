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

  // console.log("deliverableIdToUse:", deliverableIdToUse);

  if (!client || !client.monthlyDeliverables.length) {
    return { created: 0, error: "No deliverable found" };
  }

  // const deliverable = client.monthlyDeliverables[0];

  // console.log("Using deliverable:", deliverable);
  // console.log("deliverable.type:", deliverable.type);

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
  const companyName = client.companyName || client.name;
  const deliverableSlug = getDeliverableShortCode(deliverable.type);
  const createdAtStr = formatDateMMDDYYYY(templateTask.createdAt);

  // STEP 6 — Update template task with title and folder
  let count = 1;
  // const title1 = `${clientSlug}_${createdAtStr}_${deliverableSlug}_${count}`;
  const title1 = `${clientSlug}_${createdAtStr}_${deliverableSlug}${count}`;

  // 🔥 Create folder structure for template task
  const taskFolderPath1 = await createTaskFolderStructure(companyName, title1);

  await prisma.task.update({
    where: { id: taskId },
    data: { 
      title: title1,
      outputFolderId: taskFolderPath1, // 🔥 Save folder path
    },
  });

  // STEP 7 — Create remaining tasks
  const creates = [];

  for (const date of dates) {
    for (let i = 0; i < videosPerDay; i++) {
      if (count >= quantity) break;

      // Skip only the FIRST slot of the FIRST posting date
      if (date.toDateString() === firstDate.toDateString() && count === 1) {
        count++;
        continue;
      }

      count++;
      // const title = `${clientSlug}_${createdAtStr}_${deliverableSlug}_${count}`;
      const title = `${clientSlug}_${createdAtStr}_${deliverableSlug}${count}`;

      // 🔥 Create folder structure for this task
      const taskFolderPath = await createTaskFolderStructure(companyName, title);

      creates.push(
        prisma.task.create({
          data: {
            title,
            description: templateTask.description,
            taskType: templateTask.taskType,
            status: "PENDING",
            dueDate: date,
            // clientId,
            outputFolderId: taskFolderPath, // 🔥 Save folder path
            clientId: clientId,
            clientUserId: client?.userId,
            // Copy assignments
            assignedTo: templateTask.assignedTo,
            createdBy: templateTask.createdBy,
            scheduler: templateTask.scheduler,
            videographer: templateTask.videographer,
            qc_specialist: templateTask.qc_specialist,
            monthlyDeliverableId: templateTask.monthlyDeliverableId,
          },
        })
      );
    }
  }

  await Promise.all(creates);

  console.log(`✅ Created ${creates.length} tasks with folder structures`);

  return { created: creates.length };
}