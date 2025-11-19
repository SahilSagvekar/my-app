  export const runtime = "nodejs";
  export const dynamic = "force-dynamic";

  import { NextResponse } from "next/server";
  import jwt from "jsonwebtoken";
  import { prisma } from "@/lib/prisma";
  import { uploadBufferToDrive } from "../../../lib/googleDrive";

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

  // Auto-generation after the **first** manual task
  async function autoGenerateRemainingTasksForMonth(task: any) {
    console.log("🔄 Auto-generating remaining tasks for month...");
    if (!task.clientId || !task.dueDate) return;

    // Always fetch FULL client data
    const client = await prisma.client.findUnique({
      where: { id: task.clientId },
      include: {
        monthlyDeliverables: true,
      },
    });

    console.log("Client data:", client);

    if (!client) return;
    if (!client.monthlyDeliverables || client.monthlyDeliverables.length === 0) return;

    const deliverable = client.monthlyDeliverables[0];

    // Rename FIRST task (manual task)
    const createdAt = new Date(task.createdAt || Date.now());

    const createdDateStr = createdAt.toISOString().slice(0, 10);

    const clientSlug = (client.name || "Client").replace(/\s+/g, "");
    const deliverableSlug = (deliverable.type || task.taskType || "Task").replace(/\s+/g, "");

    const firstTitle = `${clientSlug}_${createdDateStr}_${deliverableSlug}_1`;

    console.log("Renaming first task to:", firstTitle);

    await prisma.task.update({
      where: { id: task.id },
      data: { title: firstTitle },
    });

    // await prisma.recurringTask.updateMany({
    //   where: { id: task.id },
    //   data: { title: firstTitle },
    // });

    // Now generate the rest
    const totalQuantity = deliverable.quantity ?? 1;
    const videosPerDay = deliverable.videosPerDay ?? 1;
    const postingDays = deliverable.postingDays ?? [];

    // Compute month range
    const due = new Date(task.dueDate);
    const monthStart = new Date(due.getFullYear(), due.getMonth(), 1);
    const monthEnd = new Date(due.getFullYear(), due.getMonth() + 1, 0);

    let createdCount = 1; // first is done

    const WEEKDAY_MAP = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };

    const validDays = postingDays.map((d) => WEEKDAY_MAP[d as keyof typeof WEEKDAY_MAP]).filter(v => v !== undefined);

    const dueDates: Date[] = [];

    if (validDays.length > 0) {
      const cursor = new Date(monthStart);
      while (cursor <= monthEnd) {
        if (validDays.includes(cursor.getDay())) {
          dueDates.push(new Date(cursor));
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      // fallback
      dueDates.push(new Date(task.dueDate));
    }

    const creates = [];

    outer: for (const date of dueDates) {
      for (let v = 0; v < videosPerDay; v++) {
        createdCount++;
        if (createdCount > totalQuantity) break outer;

        const autoTitle = `${clientSlug}_${createdDateStr}_${deliverableSlug}_${createdCount}`;

        // creates.push(
        //   prisma.task.create({
        //     data: {
        //       title: autoTitle,
        //       description: task.description,
        //       taskType: task.taskType,
        //       status: "PENDING",
        //       dueDate: date,
        //       assignedTo: task.assignedTo,
        //       createdBy: task.createdBy,
        //       clientId: task.clientId,
        //     },
        //   })
        // );

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


  // ─────────────────────────────────────────
  // GET /api/tasks
  // ─────────────────────────────────────────

  export async function GET(req: Request) {
    try {
      const token = getTokenFromCookies(req);
      if (!token) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
      const { role, userId } = decoded;

      const where =
        ["admin", "manager"].includes(role)
          ? {}
          : { assignedTo: Number(userId) };

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
        },
        
      });

      return NextResponse.json({ tasks }, { status: 200 });
    } catch (err: any) {
      console.error("❌ GET /api/tasks error:", err);
      return NextResponse.json(
        { message: "Server error", error: err.message },
        { status: 500 },
      );
    }
  }

  // ─────────────────────────────────────────
  // POST /api/tasks  (Create manual + auto)
  // ─────────────────────────────────────────

  export async function POST(req: Request) {
    try {
      // ------------- AUTH --------------
      const token = getTokenFromCookies(req);
      if (!token)
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
      if (!["admin", "manager"].includes(decoded.role)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      // ------------- PARSE FORM DATA --------------
      const form = await req.formData();

      const description = form.get("description") as string;
      const dueDate = form.get("dueDate") as string;
      const assignedTo = form.get("assignedTo") as string;
      const qc_specialist = form.get("qc_specialist") as string;
      const scheduler = form.get("scheduler") as string;
      const videographer = form.get("videographer") as string;
      const clientId = form.get("clientId") as string;
      const folderType = form.get("folderType") as string;

      if ( !assignedTo || !folderType || !clientId) {
        return NextResponse.json(
          { message: "Missing required fields" },
          { status: 400 }
        );
      }

      // ------------- FETCH CLIENT FOLDER --------------
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: {
          rawFootageFolderId: true,
          essentialsFolderId: true,
        },
      });

      if (!client) {
        return NextResponse.json(
          { message: "Client not found" },
          { status: 404 }
        );
      }

      const targetFolder =
        folderType === "rawFootage"
          ? client.rawFootageFolderId
          : client.essentialsFolderId;

      if (!targetFolder) {
        return NextResponse.json(
          { message: `Folder ID not found for ${folderType}` },
          { status: 400 }
        );
      }

      // ------------- FILE UPLOAD --------------
      const uploadedLinks: string[] = [];
      const files = form.getAll("files") as File[];

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // const uploaded = await uploadBufferToDrive({
        //   buffer,
        //   folderId: targetFolder,
        //   filename: file.name,
        //   mimeType: file.type,
        // });

        // uploadedLinks.push(uploaded.webViewLink ?? "NULL");

        const uploadedFile = await uploadBufferToDrive({
          buffer,
          folderId: targetFolder,
          filename: file.name,
          mimeType: file.type,
        });

        const fileRecord = await prisma.file.create({
          data: {
            taskId: task.id,
            name: file.name,
            url: uploadedFile.webViewLink ?? "",
            mimeType: file.type,
            size: buffer.length,
            uploadedBy: decoded.userId,
          },
        });

      }

      // ------------- CREATE FIRST (MANUAL) TASK --------------
      const task = await prisma.task.create({
        data: {
          // we still accept the manual title but will overwrite with pattern
          title: "",
          description: description || "",
          // taskType,
          dueDate: new Date(dueDate),
          assignedTo: Number(assignedTo),
          qc_specialist:  Number(qc_specialist),
          scheduler:     Number(scheduler),
          videographer:  Number(videographer),
          createdBy: decoded.userId,
          clientId,
          driveLinks: uploadedLinks,
        },
      });

      // ------------- AUTO-GENERATE REMAINING TASKS --------------
      await autoGenerateRemainingTasksForMonth(task);

      // Check if this is the first task of the month
      // const existingTasksThisMonth = await prisma.task.count({
      //   where: {
      //     clientId,
      //     createdAt: {
      //       gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      //     },
      //   },
      // });

      // if (existingTasksThisMonth === 1) {
      //   // This was the FIRST task → run auto gen
      //   await autoGenerateRemainingTasksForMonth(task);
      // }

      return NextResponse.json(task, { status: 201 });
    } catch (err: any) {
      console.error("❌ Create task error:", err);
      return NextResponse.json(
        { message: "Server error", error: err.message },
        { status: 500 },
      );
    }
  }
