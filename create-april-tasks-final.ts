// create-april-tasks-final.ts
// Creates missing April 2026 tasks based on monthFolder check

import { prisma } from "./src/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
const DRY_RUN = false; // Set to false to actually create tasks

const TARGET_YEAR = 2026;
const TARGET_MONTH = 3; // April (0-indexed)
const MONTH_FOLDER = "April-2026";
const RECURRING_MONTH_LABEL = "2026-04";

// ─────────────────────────────────────────
// S3/R2 Setup
// ─────────────────────────────────────────
const IS_R2 = !!process.env.R2_ENDPOINT;
const s3Client = new S3Client({
  region: IS_R2 ? "auto" : (process.env.AWS_S3_REGION || "us-east-1"),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  ...(IS_R2 && {
    endpoint: process.env.R2_ENDPOINT!,
    forcePathStyle: true,
  }),
});
const BUCKET = process.env.AWS_S3_BUCKET || "e8-app-r2-prod";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function getDeliverableShortCode(type: string): string {
  const normalized = type.toLowerCase().trim();
  if (normalized === "short form videos") return "SF";
  if (normalized === "long form videos") return "LF";
  if (normalized === "square form videos") return "SQF";
  if (normalized === "thumbnails") return "THUMB";
  if (normalized === "tiles") return "T";
  if (normalized === "hard posts / graphic images") return "HP";
  if (normalized === "snapchat episodes") return "SEP";
  if (normalized === "beta short form") return "BSF";
  return type.replace(/\s+/g, "");
}

function formatDateMMDDYYYY(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

async function createTaskFolderStructure(
  companyName: string,
  taskTitle: string,
  monthFolder: string
): Promise<string> {
  const safeCompanyName = companyName.replace(/[,]/g, "").trim();
  const taskFolderPath = `${safeCompanyName}/outputs/${monthFolder}/${taskTitle}/`;
  
  if (DRY_RUN) return taskFolderPath;

  try {
    const folders = [
      `${safeCompanyName}/outputs/${monthFolder}/`,
      taskFolderPath,
      `${taskFolderPath}thumbnails/`,
      `${taskFolderPath}tiles/`,
      `${taskFolderPath}music-license/`,
    ];
    await Promise.all(
      folders.map((folder) =>
        s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: folder,
            ContentType: "application/x-directory",
          })
        )
      )
    );
  } catch (error) {
    console.error(`   ⚠️ Failed to create folder for ${taskTitle}`);
  }
  return taskFolderPath;
}

function generateDueDates(quantity: number, year: number, month: number): Date[] {
  const dates: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let i = 0; i < quantity; i++) {
    const day = Math.min(Math.floor((i / quantity) * daysInMonth) + 1, daysInMonth);
    dates.push(new Date(year, month, day, 10, 0, 0));
  }
  return dates;
}

async function createAprilTasks() {
  console.log("=".repeat(70));
  console.log(`🚀 CREATE MISSING APRIL 2026 TASKS ${DRY_RUN ? "(DRY RUN)" : "⚠️ LIVE MODE"}`);
  console.log("=".repeat(70));

  // Get default user for assignment
  const defaultUser = await prisma.user.findFirst({
    where: { role: { in: ["admin", "manager"] }, employeeStatus: "ACTIVE" },
    select: { id: true, name: true },
  });

  if (!defaultUser) {
    console.log("❌ No active admin/manager found!");
    await prisma.$disconnect();
    return;
  }
  console.log(`\n👤 Default assignee: ${defaultUser.name} (ID: ${defaultUser.id})`);

  const createdDateStr = formatDateMMDDYYYY(new Date(TARGET_YEAR, TARGET_MONTH, 1));

  // Get all clients with deliverables
  const clients = await prisma.client.findMany({
    include: {
      monthlyDeliverables: true,
    },
    orderBy: { name: "asc" },
  });

  let totalCreated = 0;
  let deliverablesFilled = 0;

  for (const client of clients) {
    const clientName = client.companyName || client.name;
    const clientSlug = clientName.replace(/\s+/g, "").replace(/[,]/g, "");

    if (client.monthlyDeliverables.length === 0) continue;

    let clientHasMissing = false;

    for (const del of client.monthlyDeliverables) {
      const expected = del.quantity || 0;
      if (expected === 0) continue;

      // Count existing April tasks using monthFolder
      const existingCount = await prisma.task.count({
        where: {
          clientId: client.id,
          monthlyDeliverableId: del.id,
          monthFolder: MONTH_FOLDER,
        },
      });

      const needed = expected - existingCount;
      if (needed <= 0) continue;

      if (!clientHasMissing) {
        console.log(`\n${"─".repeat(50)}`);
        console.log(`🏢 ${clientName}`);
        clientHasMissing = true;
      }

      console.log(`   📦 ${del.type}: ${existingCount}/${expected} → Need ${needed}`);
      deliverablesFilled++;

      // Get template from RecurringTask if exists
      const recurringTask = await prisma.recurringTask.findFirst({
        where: { clientId: client.id, deliverableId: del.id },
        include: { templateTask: true },
      });
      const template = recurringTask?.templateTask;

      const deliverableSlug = getDeliverableShortCode(del.type);
      const dueDates = generateDueDates(needed, TARGET_YEAR, TARGET_MONTH);

      if (DRY_RUN) {
        console.log(`      🔹 Would create ${needed} tasks`);
        totalCreated += needed;
        continue;
      }

      // Create tasks
      const tasksToCreate: any[] = [];

      for (let i = 0; i < needed; i++) {
        const taskNumber = existingCount + i + 1;
        const title = `${clientSlug}_${createdDateStr}_${deliverableSlug}${taskNumber}`;
        const outputFolderId = await createTaskFolderStructure(clientName, title, MONTH_FOLDER);

        tasksToCreate.push({
          title,
          description: template?.description || `${del.type} for ${clientName}`,
          taskType: template?.taskType || del.type,
          status: "PENDING",
          dueDate: dueDates[i],
          assignedTo: template?.assignedTo || defaultUser.id,
          createdBy: template?.createdBy,
          clientId: client.id,
          clientUserId: client.userId,
          monthlyDeliverableId: del.id,
          outputFolderId,
          monthFolder: MONTH_FOLDER,
          recurringMonth: RECURRING_MONTH_LABEL,
          qc_specialist: template?.qc_specialist,
          scheduler: template?.scheduler,
          videographer: template?.videographer,
          folderType: template?.folderType,
          driveLinks: template?.driveLinks ?? [],
        });
      }

      // Create in batches
      const BATCH_SIZE = 50;
      for (let i = 0; i < tasksToCreate.length; i += BATCH_SIZE) {
        const batch = tasksToCreate.slice(i, i + BATCH_SIZE);
        await prisma.task.createMany({ data: batch });
      }
      
      console.log(`      ✅ Created ${tasksToCreate.length} tasks`);
      totalCreated += tasksToCreate.length;
    }
  }

  // Also handle Free Laundromat which has no MonthlyDeliverables
  // Check if it has March tasks we should replicate
  const freeLaundromat = await prisma.client.findFirst({
    where: { companyName: { contains: "Free Laundromat" } },
  });

  if (freeLaundromat) {
    const marchTasks = await prisma.task.findMany({
      where: {
        clientId: freeLaundromat.id,
        dueDate: {
          gte: new Date(2026, 2, 1),
          lte: new Date(2026, 2, 31, 23, 59, 59),
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const aprilCount = await prisma.task.count({
      where: {
        clientId: freeLaundromat.id,
        monthFolder: MONTH_FOLDER,
      },
    });

    if (marchTasks.length > 0 && aprilCount === 0) {
      console.log(`\n${"─".repeat(50)}`);
      console.log(`🏢 Free Laundromat, LLC (no MonthlyDeliverables - copying from March)`);
      console.log(`   📦 March tasks: ${marchTasks.length}, April tasks: ${aprilCount}`);

      if (DRY_RUN) {
        console.log(`      🔹 Would create ${marchTasks.length} tasks based on March`);
        totalCreated += marchTasks.length;
      } else {
        const clientSlug = "FreeLaundromatLLC";
        const dueDates = generateDueDates(marchTasks.length, TARGET_YEAR, TARGET_MONTH);
        
        // Group by taskType to create proper numbering
        const byType: Record<string, typeof marchTasks> = {};
        for (const t of marchTasks) {
          const type = t.taskType || "Unknown";
          if (!byType[type]) byType[type] = [];
          byType[type].push(t);
        }

        let created = 0;
        for (const [taskType, tasks] of Object.entries(byType)) {
          const deliverableSlug = getDeliverableShortCode(taskType);
          const typeDueDates = generateDueDates(tasks.length, TARGET_YEAR, TARGET_MONTH);
          
          for (let i = 0; i < tasks.length; i++) {
            const template = tasks[i];
            const title = `${clientSlug}_${createdDateStr}_${deliverableSlug}${i + 1}`;
            const outputFolderId = await createTaskFolderStructure("Free Laundromat LLC", title, MONTH_FOLDER);

            await prisma.task.create({
              data: {
                title,
                description: template.description,
                taskType: template.taskType,
                status: "PENDING",
                dueDate: typeDueDates[i],
                assignedTo: template.assignedTo,
                createdBy: template.createdBy,
                clientId: freeLaundromat.id,
                clientUserId: freeLaundromat.userId,
                outputFolderId,
                monthFolder: MONTH_FOLDER,
                recurringMonth: RECURRING_MONTH_LABEL,
                qc_specialist: template.qc_specialist,
                scheduler: template.scheduler,
                videographer: template.videographer,
                folderType: template.folderType,
                driveLinks: template.driveLinks ?? [],
              },
            });
            created++;
          }
        }
        console.log(`      ✅ Created ${created} tasks`);
        totalCreated += created;
        deliverablesFilled++;
      }
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`🎉 COMPLETE!`);
  console.log(`   📦 Deliverables filled: ${deliverablesFilled}`);
  console.log(`   ✨ Tasks ${DRY_RUN ? "to create" : "created"}: ${totalCreated}`);
  
  if (DRY_RUN) {
    console.log(`\n   💡 Set DRY_RUN = false to create these tasks`);
  }
  
  console.log(`${"=".repeat(70)}`);
  await prisma.$disconnect();
}

createAprilTasks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });