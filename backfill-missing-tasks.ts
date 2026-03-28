// backfill-missing-tasks.ts
import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// R2-compatible S3 client configuration
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

function getDeliverableShortCode(type: string) {
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

function formatDateMMDDYYYY(date: Date) {
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
  try {
    // Monthly grouped path: CompanyName/outputs/Month-Year/TaskTitle/
    const taskFolderPath = `${companyName}/outputs/${monthFolder}/${taskTitle}/`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: taskFolderPath,
        ContentType: "application/x-directory",
      })
    );

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${taskFolderPath}thumbnails/`,
        ContentType: "application/x-directory",
      })
    );

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${taskFolderPath}tiles/`,
        ContentType: "application/x-directory",
      })
    );

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${taskFolderPath}music-license/`,
        ContentType: "application/x-directory",
      })
    );

    return taskFolderPath;
  } catch (error) {
    console.error("❌ Failed to create task folder structure:", error);
    throw error;
  }
}

export async function backfillMissingTasks() {
  console.log("🔍 Starting backfill process...\n");

  // Get all monthly deliverables directly
  const deliverables = await prisma.monthlyDeliverable.findMany({
    include: {
      client: true,
    },
  });

  console.log(`Found ${deliverables.length} monthly deliverables\n`);

  let totalCreated = 0;
  let groupsFixed = 0;

  // Get current month in YYYY-MM format
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  console.log(`📅 Filtering tasks for month: ${currentMonth}\n`);

  for (const deliverable of deliverables) {
    const expectedQuantity = deliverable.quantity ?? 1;

    // Count existing tasks for this deliverable IN CURRENT MONTH ONLY
    const existingTasks = await prisma.task.findMany({
      where: {
        monthlyDeliverableId: deliverable.id,
        recurringMonth: currentMonth,  // 👈 Filter by current month
      },
      orderBy: { createdAt: "asc" },
    });

    const existingCount = existingTasks.length;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Client: ${deliverable.client.name}`);
    console.log(`   Deliverable: ${deliverable.type}`);
    console.log(`   Expected: ${expectedQuantity}, Existing: ${existingCount}`);

    // Skip if no tasks exist at all (not started yet)
    if (existingCount === 0) {
      console.log(`   ⚠️ No tasks exist yet - skipping (use normal task creation)\n`);
      continue;
    }

    // Skip if already complete
    if (existingCount >= expectedQuantity) {
      console.log(`   ✅ Already complete - skipping\n`);
      continue;
    }

    const missingCount = expectedQuantity - existingCount;
    console.log(`   🔨 Need to create ${missingCount} more tasks`);
    groupsFixed++;

    // Get template data from first existing task
    const templateTask = existingTasks[0];
    const companyName = deliverable.client.companyName || deliverable.client.name;
    const companyNameSlug = companyName.replace(/\s/g, "");
    const deliverableSlug = getDeliverableShortCode(deliverable.type);
    const createdAtStr = formatDateMMDDYYYY(templateTask.createdAt);

    // Get month boundaries from first task's due date
    const firstDate = new Date(templateTask.dueDate);
    const monthEnd = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);

    // Build date list
    const dates: Date[] = [];
    const cursor = new Date(firstDate);
    while (cursor <= monthEnd) {
      dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    const daysAvailable = dates.length;
    const tasksPerDay = Math.ceil(expectedQuantity / daysAvailable);

    console.log(`   📅 Date range: ${firstDate.toLocaleDateString()} to ${monthEnd.toLocaleDateString()}`);
    console.log(`   📆 Days available: ${daysAvailable}, Tasks per day: ${tasksPerDay}`);

    // Create missing tasks
    const creates = [];
    let count = existingCount; // Start numbering from where we left off
    let dateIndex = 0;
    let dayTaskCount = 0;

    // Figure out which date we should start from
    const lastTask = existingTasks[existingCount - 1];
    const lastDate = new Date(lastTask.dueDate);
    dateIndex = dates.findIndex(d => d.toDateString() === lastDate.toDateString());
    
    // Count how many tasks already exist on the last date
    const tasksOnLastDate = existingTasks.filter(
      t => new Date(t.dueDate).toDateString() === lastDate.toDateString()
    ).length;
    dayTaskCount = tasksOnLastDate;

    console.log(`   📍 Continuing from: ${lastDate.toLocaleDateString()} (${tasksOnLastDate} tasks already on this day)\n`);

    // Continue from where we left off
    while (count < expectedQuantity && dateIndex < dates.length) {
      const date = dates[dateIndex];

      for (let i = dayTaskCount; i < tasksPerDay; i++) {
        if (count >= expectedQuantity) break;

        count++;
        const title = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${count}`;

        try {
          // Get month folder name (e.g., "March-2026")
          const monthNames = ["January", "February", "March", "April", "May", "June", 
                              "July", "August", "September", "October", "November", "December"];
          const monthFolder = `${monthNames[date.getMonth()]}-${date.getFullYear()}`;
          
          const taskFolderPath = await createTaskFolderStructure(companyName, title, monthFolder);

          creates.push(
            prisma.task.create({
              data: {
                title,
                description: templateTask.description,
                taskType: templateTask.taskType,
                status: "PENDING",
                dueDate: date,
                outputFolderId: taskFolderPath,
                clientId: deliverable.clientId,
                clientUserId: deliverable.client.userId,
                assignedTo: templateTask.assignedTo,
                createdBy: templateTask.createdBy,
                scheduler: templateTask.scheduler,
                videographer: templateTask.videographer,
                qc_specialist: templateTask.qc_specialist,
                monthlyDeliverableId: deliverable.id,
                recurringMonth: currentMonth,  // 👈 Tag with current month
                monthFolder: monthFolder,       // 👈 Month folder for R2 path
              },
            })
          );

          console.log(`   ➕ Queued: ${title} (Due: ${date.toLocaleDateString()})`);
        } catch (error) {
          console.error(`   ❌ Failed to create task ${title}:`, error);
        }
      }

      dateIndex++;
      dayTaskCount = 0; // Reset for next day
    }

    if (creates.length > 0) {
      console.log(`\n   💾 Saving ${creates.length} tasks to database...`);
      await Promise.all(creates);
      console.log(`   ✅ Created ${creates.length} missing tasks\n`);
      totalCreated += creates.length;
    }
  }

  console.log(`${"=".repeat(50)}`);
  console.log(`🎉 Backfill complete!`);
  console.log(`   📦 Groups fixed: ${groupsFixed}`);
  console.log(`   ✨ Total tasks created: ${totalCreated}`);
  console.log(`${"=".repeat(50)}`);
  
  return { totalCreated, groupsFixed };
}

// Run the backfill
backfillMissingTasks()
  .then((result) => {
    console.log("\n✅ Success:", result);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });