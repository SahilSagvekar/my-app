export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import "@/lib/bigint-fix";  
import { prisma } from "@/lib/prisma";
import { uploadBufferToS3 } from "@/lib/s3";
import { TaskStatus } from "@prisma/client";
import { ClientRequest } from "http";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateMonthlyTasksFromTemplate } from "@/lib/recurring/generateMonthly";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
import { redis, cached } from '@/lib/redis';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Helper to get current month folder name
function getCurrentMonthFolder(): string {
  const date = new Date();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${month}-${year}`; // "December-2024"
}

export const config = {
  api: { bodyParser: false },
};

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

const buildRoleWhereQuery = (role: string, userId: number): any => {
  if (!role) {
    return {}; // Return empty query or default behavior
  }
  
  switch (role.toLowerCase()) {
    case "editor":
      return {
        AND: [
          { assignedTo: userId },
          {
            status: {
              in: [
                TaskStatus.PENDING,
                TaskStatus.IN_PROGRESS,
                TaskStatus.READY_FOR_QC,
                TaskStatus.REJECTED,
              ],
            },
          },
        ],
      };

    case "qc":
      return {
        AND: [
          { qc_specialist: userId },
          {
            status: {
              in: [TaskStatus.READY_FOR_QC],
            },
          },
        ],
      };

    case "scheduler":
      return {
        AND: [
          { scheduler: userId },
          {
            status: {
              in: [TaskStatus.COMPLETED],
            },
          },
        ],
      };

    case "client":
      return {
        AND: [
          { clientUserId: Number(userId) },
          {
            status: {
              in: [TaskStatus.CLIENT_REVIEW, TaskStatus.IN_PROGRESS, TaskStatus.SCHEDULED],
            },
          },
        ],
      };

      case "videographer":
      return {
        AND: [
          { videographer: userId },
          {
            status: {
              in: [TaskStatus.VIDEOGRAPHER_ASSIGNED],
            },
          },
        ],
      };

    case "manager":
    case "admin":
      return {};

    default:
      return { assignedTo: userId };
  }
};

// Simple weekday map for postingDays like ["Monday", "Wednesday"]
const WEEKDAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

async function autoGenerateRemainingTasksForMonth(task: any) {
  if (!task.clientId || !task.dueDate) return;

  const client = await prisma.client.findUnique({
    where: { id: task.clientId },
    include: { monthlyDeliverables: true },
  });

  if (!client || !client.monthlyDeliverables.length) return;

  const deliverable = client.monthlyDeliverables[0];

  const createdAt = new Date(task.createdAt || Date.now());
  const createdDateStr = createdAt.toISOString().slice(0, 10);

  const clientSlug = client.name.replace(/\s+/g, "");
  const deliverableSlug = deliverable.type.replace(/\s+/g, "");

  const firstTitle = `${clientSlug}_${createdDateStr}_${deliverableSlug}_1`;

  await prisma.task.update({
    where: { id: task.id },
    data: { title: firstTitle },
  });

  const totalQty = deliverable.quantity ?? 1;
  const videosPerDay = deliverable.videosPerDay ?? 1;
  const postingDays = deliverable.postingDays ?? [];

  const due = new Date(task.dueDate);
  const monthStart = new Date(due.getFullYear(), due.getMonth(), 1);
  const monthEnd = new Date(due.getFullYear(), due.getMonth() + 1, 0);

  const WEEKDAY_MAP = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  const validDays = postingDays
    .map((d) => WEEKDAY_MAP[d as keyof typeof WEEKDAY_MAP])
    .filter((v) => v !== undefined);

  const dueDates: Date[] = [];
  const cursor = new Date(monthStart);

  while (cursor <= monthEnd) {
    if (validDays.includes(cursor.getDay())) {
      dueDates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  let count = 1;
  const creates = [];

  outer: for (const date of dueDates) {
    for (let v = 0; v < videosPerDay; v++) {
      count++;
      if (count > totalQty) break outer;

      const autoTitle = `${clientSlug}_${createdDateStr}_${deliverableSlug}_${count}`;

      creates.push(
        prisma.task.create({
          data: {
            title: autoTitle,
            description: task.description,
            taskType: task.taskType,
            status: "PENDING",
            dueDate: date,
            assignedTo: task.assignedTo,
            createdBy: task.createdBy,
            clientId: task.clientId,
          },
        })
      );
    }
  }

  await Promise.all(creates);
}

export async function GET(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    const where = buildRoleWhereQuery(role, Number(userId));

    // Add pagination parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const cacheKey = `tasks:${userId}:${role}:${page}:${limit}`;

    const tasks = await cached(
      cacheKey,
      async () => {
        const where = buildRoleWhereQuery(role, Number(userId));
        
        return prisma.task.findMany({
          where,
          take: limit,
          skip: (page - 1) * limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            taskType: true,
            status: true,
            dueDate: true,
            assignedTo: true,
            createdBy: true,
            clientId: true,
            clientUserId: true,
            driveLinks: true,
            createdAt: true,
            priority: true,
            taskCategory: true,
            nextDestination: true,
            requiresClientReview: true,
            workflowStep: true,
            folderType: true,
            qcNotes: true,
            feedback: true,
            files: true,
            monthlyDeliverable: true, 
            socialMediaLinks: true,
          },
        });
      },
      900
    );

    // ✅ NO COUNT QUERY - just return tasks
    return NextResponse.json({ tasks }, { status: 200 });
  } catch (err: any) {
    console.error("❌ GET /api/tasks error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // 🔒 AUTH
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    const { role, userId } = decoded;

    if (!["admin", "manager"].includes(decoded.role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // 📝 Read FormData
    const form = await req.formData();

    const description = form.get("description") as string;
    const dueDate = form.get("dueDate") as string;
    const assignedTo = Number(form.get("assignedTo"));
    const qc_specialist = Number(form.get("qc_specialist"));
    const scheduler = Number(form.get("scheduler"));
    const videographer = Number(form.get("videographer"));
    const clientId = form.get("clientId") as string;
    const folderType = form.get("folderType") as string;
    const monthlyDeliverableId = form.get("monthlyDeliverableId") as string;

    if (!assignedTo || !clientId || !folderType) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // 📁 GET CLIENT FOLDERS FROM DB
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        name: true,
        companyName: true,
        rawFootageFolderId: true,
        essentialsFolderId: true,
        requiresClientReview: true,
        requiresVideographer: true,
        userId: true,
      },
    });

    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    // 🔥 Determine folder prefix based on folder type
    let folderPrefix = '';
    
    if (folderType === "rawFootage") {
      // Get company name
      const companyName = client.companyName || client.name;
      
      // Get current month folder
      const currentMonth = getCurrentMonthFolder(); // "December-2024"
      
      // Build path with month folder: companyName/raw-footage/December-2024/
      const rawFootageBase = client.rawFootageFolderId || `${companyName}/raw-footage/`;
      folderPrefix = `${rawFootageBase}${currentMonth}/`;
      
      // 🔥 Create the month folder (if it doesn't exist)
      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: folderPrefix, // This creates the folder
            ContentType: "application/x-directory",
          })
        );
        console.log('✅ Month folder ensured:', folderPrefix);
      } catch (error) {
        console.log('⚠️ Folder might already exist (ok):', error);
      }
            
    } else {
      // Elements folder - use normal path
      folderPrefix = client.essentialsFolderId || '';
    }

    if (!folderPrefix) {
      return NextResponse.json(
        { message: `Missing folder for ${folderType}` },
        { status: 400 }
      );
    }

    // 🗂️ Collect file URLs
    const uploadedLinks: string[] = [];
    const files = form.getAll("files") as File[];

    // 📝 CREATE TASK FIRST (we need task.id)
    const task = await prisma.task.create({
      data: {
        title: "",
        description: description || "",
        dueDate: new Date(dueDate),
        assignedTo,
        qc_specialist,
        scheduler,
        videographer,
        createdBy: decoded.userId,
        clientId: clientId,
        clientUserId: client?.userId,
        monthlyDeliverableId: monthlyDeliverableId,
        driveLinks: uploadedLinks,
        folderType,
        requiresClientReview: client.requiresClientReview,
        status: client.requiresVideographer
          ? "VIDEOGRAPHER_ASSIGNED"
          : "PENDING",
      },
    });

    await createAuditLog({
      userId: userId,
      action: AuditAction.TASK_CREATED,
      entity: 'Task',
      entityId: task.id,
      details: `Created task: ${task.title}`,
      metadata: {
        taskId: task.id,
        assignedTo: assignedTo,
        status: task.status
      },
    });

    // 📤 UPLOAD FILES TO S3 (into the month folder for raw footage)
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      const uploaded = await uploadBufferToS3({
        buffer,
        folderPrefix, // This already includes the month folder for raw footage
        filename: file.name,
        mimeType: file.type,
      });

      uploadedLinks.push(uploaded.url);

      await prisma.file.create({
        data: {
          taskId: task.id,
          name: file.name,
          url: uploaded.url,
          mimeType: file.type,
          size: BigInt(buffer.length),
          uploadedBy: decoded.userId,
        },
      });
    }

    // 🆙 UPDATE TASK WITH FILE LINKS
    await prisma.task.update({
      where: { id: task.id },
      data: { driveLinks: uploadedLinks },
    });

    // 🔁 AUTO GENERATE TASKS
    console.log("generateMonthlyTasksFromTemplate");
    await generateMonthlyTasksFromTemplate(task.id, monthlyDeliverableId);

    const usersToInvalidate = [
      userId,
      assignedTo,
      qc_specialist,
      scheduler,
      videographer,
      client.userId
    ].filter(Boolean);

    for (const uid of usersToInvalidate) {
      const keys = await redis.keys(`tasks:${uid}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    console.error("❌ Create task error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}
