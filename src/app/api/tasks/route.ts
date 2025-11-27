export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { uploadBufferToS3 } from "@/lib/s3";
import { TaskStatus } from "@prisma/client";
import { ClientRequest } from "http";
import { generateMonthlyTasksFromTemplate } from "@/lib/recurring/generateMonthly";


// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

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
        AND: [{ requiresClientReview: true }, { clientUserId: userId }],
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
  console.log("task:", task.id);
  if (!task.clientId || !task.dueDate) return;

  const client = await prisma.client.findUnique({
    where: { id: task.clientId },
    include: { monthlyDeliverables: true },
  });

  console.log("client:", client);

  if (!client || !client.monthlyDeliverables.length) return;

  const deliverable = client.monthlyDeliverables[0];

  console.log("deliverable:", deliverable);

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

    // const where =
    //   ["admin", "manager"].includes(role)
    //     ? {}
    //     : { assignedTo: Number(userId) };

    const where = buildRoleWhereQuery(role, Number(userId));

    const tasks = await prisma.task.findMany({
      where,
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
        driveLinks: true,
        createdAt: true,
        priority: true,
        taskCategory: true,
        nextDestination: true,
        requiresClientReview: true,
        workflowStep: true,
        files: true,
        folderType: true,
      },

    });

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

    if (!assignedTo || !clientId || !folderType) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // 📁 GET CLIENT FOLDERS FROM DB
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { rawFootageFolderId: true, essentialsFolderId: true },
    });

    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    const folderPrefix =
      folderType === "rawFootage"
        ? client.rawFootageFolderId
        : client.essentialsFolderId;

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
        clientId,
        driveLinks: uploadedLinks,
        folderType,
      },
    });

    // 📤 UPLOAD FILES TO S3
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      const uploaded = await uploadBufferToS3({
        buffer,
        folderPrefix,
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
          size: buffer.length,
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
    await generateMonthlyTasksFromTemplate(task.id);

    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    console.error("❌ Create task error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}
