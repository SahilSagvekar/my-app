// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

// import { NextResponse } from "next/server";
// import jwt from "jsonwebtoken";
// import "@/lib/bigint-fix";
// import { prisma } from "@/lib/prisma";
// import { uploadBufferToS3 } from "@/lib/s3";
// import { TaskStatus } from "@prisma/client";
// import { ClientRequest } from "http";
// import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
// import { generateMonthlyTasksFromTemplate } from "@/lib/recurring/generateMonthly";
// import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';

// // ─────────────────────────────────────────
// // Helpers
// // ─────────────────────────────────────────

// const s3Client = new S3Client({
//   region: process.env.AWS_S3_REGION!,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//   },
// });

// // Helper to get current month folder name
// function getCurrentMonthFolder(): string {
//   const date = new Date();
//   const month = date.toLocaleDateString('en-US', { month: 'long' });
//   const year = date.getFullYear();
//   return `${month}-${year}`; // "December-2024"
// }

// export const config = {
//   api: { bodyParser: false },
// };

// function getTokenFromCookies(req: Request) {
//   const cookieHeader = req.headers.get("cookie");
//   if (!cookieHeader) return null;
//   const match = cookieHeader.match(/authToken=([^;]+)/);
//   return match ? match[1] : null;
// }

// const buildRoleWhereQuery = (role: string, userId: number): any => {
//   if (!role) {
//     return {}; // Return empty query or default behavior
//   }

//   switch (role.toLowerCase()) {
//     case "editor":
//       return {
//         AND: [
//           { assignedTo: userId },
//           {
//             status: {
//               in: [
//                 TaskStatus.PENDING,
//                 TaskStatus.IN_PROGRESS,
//                 TaskStatus.READY_FOR_QC,
//                 TaskStatus.REJECTED,
//               ],
//             },
//           },
//         ],
//       };

//     case "qc":
//       return {
//         AND: [
//           { qc_specialist: userId },
//           {
//             status: {
//               in: [TaskStatus.READY_FOR_QC],
//             },
//           },
//         ],
//       };

//     case "scheduler":
//       return {
//         AND: [
//           { scheduler: userId },
//           {
//             status: {
//               in: [TaskStatus.COMPLETED],
//             },
//           },
//         ],
//       };

//     case "client":
//       return {
//         AND: [
//           { clientUserId: Number(userId) },
//           {
//             status: {
//               in: [TaskStatus.CLIENT_REVIEW, TaskStatus.IN_PROGRESS, TaskStatus.SCHEDULED],
//             },
//           },
//         ],
//       };

//     case "videographer":
//       return {
//         AND: [
//           { videographer: userId },
//           {
//             status: {
//               in: [TaskStatus.VIDEOGRAPHER_ASSIGNED],
//             },
//           },
//         ],
//       };

//     case "manager":
//     case "admin":
//       return {};

//     default:
//       return { assignedTo: userId };
//   }
// };

// // Simple weekday map for postingDays like ["Monday", "Wednesday"]
// const WEEKDAY_MAP: Record<string, number> = {
//   Sunday: 0,
//   Monday: 1,
//   Tuesday: 2,
//   Wednesday: 3,
//   Thursday: 4,
//   Friday: 5,
//   Saturday: 6,
// };

// export async function GET(req: Request) {
//   try {
//     const token = getTokenFromCookies(req);
//     if (!token) {
//       return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
//     }

//     const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
//     const { role, userId } = decoded;

//     const where = buildRoleWhereQuery(role, Number(userId));

//     // Add pagination parameters
//     const { searchParams } = new URL(req.url);
//     const page = parseInt(searchParams.get("page") || "1");
//     const limit = parseInt(searchParams.get("limit") || "20");

//     const tasks = await prisma.task.findMany({
//       where,
//       take: limit,
//       skip: (page - 1) * limit,
//       orderBy: { createdAt: "desc" },
//       select: {
//         id: true,
//         title: true,
//         description: true,
//         taskType: true,
//         status: true,
//         dueDate: true,
//         assignedTo: true,
//         createdBy: true,
//         clientId: true,
//         clientUserId: true,
//         driveLinks: true,
//         createdAt: true,
//         priority: true,
//         taskCategory: true,
//         nextDestination: true,
//         requiresClientReview: true,
//         workflowStep: true,
//         folderType: true,
//         qcNotes: true,
//         feedback: true,
//         files: true,
//         monthlyDeliverable: true,
//         socialMediaLinks: true,
//       },
//     });

//     // ✅ NO COUNT QUERY - just return tasks
//     return NextResponse.json({ tasks }, { status: 200 });
//   } catch (err: any) {
//     console.error("❌ GET /api/tasks error:", err);
//     return NextResponse.json(
//       { message: "Server error", error: err.message },
//       { status: 500 }
//     );
//   }
// }

// export async function POST(req: Request) {
//   try {
//     // 🔒 AUTH
//     const token = getTokenFromCookies(req);
//     if (!token)
//       return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

//     const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

//     const { role, userId } = decoded;

//     if (!["admin", "manager"].includes(decoded.role)) {
//       return NextResponse.json({ message: "Forbidden" }, { status: 403 });
//     }

//     // 📝 Read FormData
//     const form = await req.formData();

//     const description = form.get("description") as string;
//     const dueDate = form.get("dueDate") as string;
//     const assignedTo = Number(form.get("assignedTo"));
//     const qc_specialist = Number(form.get("qc_specialist"));
//     const scheduler = Number(form.get("scheduler"));
//     const videographer = Number(form.get("videographer"));
//     const clientId = form.get("clientId") as string;
//     const folderType = form.get("folderType") as string;
//     const monthlyDeliverableId = form.get("monthlyDeliverableId") as string;

//     if (!assignedTo || !clientId || !folderType) {
//       return NextResponse.json(
//         { message: "Missing required fields" },
//         { status: 400 }
//       );
//     }

//     // 📁 GET CLIENT FOLDERS FROM DB
//     const client = await prisma.client.findUnique({
//       where: { id: clientId },
//       select: {
//         name: true,
//         companyName: true,
//         rawFootageFolderId: true,
//         essentialsFolderId: true,
//         requiresClientReview: true,
//         requiresVideographer: true,
//         userId: true,
//       },
//     });

//     if (!client)
//       return NextResponse.json(
//         { message: "Client not found" },
//         { status: 404 }
//       );

//     // 🔥 Determine folder prefix based on folder type
//     let folderPrefix = '';

//     if (folderType === "rawFootage") {
//       // Get company name
//       const companyName = client.companyName || client.name;

//       // Get current month folder
//       const currentMonth = getCurrentMonthFolder(); // "December-2024"

//       // Build path with month folder: companyName/raw-footage/December-2024/
//       const rawFootageBase = client.rawFootageFolderId || `${companyName}/raw-footage/`;
//       folderPrefix = `${rawFootageBase}${currentMonth}/`;

//       // 🔥 Create the month folder (if it doesn't exist)
//       try {
//         await s3Client.send(
//           new PutObjectCommand({
//             Bucket: process.env.AWS_S3_BUCKET!,
//             Key: folderPrefix, // This creates the folder
//             ContentType: "application/x-directory",
//           })
//         );
//         console.log('✅ Month folder ensured:', folderPrefix);
//       } catch (error) {
//         console.log('⚠️ Folder might already exist (ok):', error);
//       }

//     } else {
//       // Elements folder - use normal path
//       folderPrefix = client.essentialsFolderId || '';
//     }

//     if (!folderPrefix) {
//       return NextResponse.json(
//         { message: `Missing folder for ${folderType}` },
//         { status: 400 }
//       );
//     }

//     // 🗂️ Collect file URLs
//     const uploadedLinks: string[] = [];
//     const files = form.getAll("files") as File[];

//     // 📝 CREATE TASK FIRST (we need task.id)
//     const task = await prisma.task.create({
//       data: {
//         title: "",
//         description: description || "",
//         dueDate: new Date(dueDate),
//         assignedTo,
//         qc_specialist,
//         scheduler,
//         videographer,
//         createdBy: decoded.userId,
//         clientId: clientId,
//         clientUserId: client?.userId,
//         monthlyDeliverableId: monthlyDeliverableId,
//         driveLinks: uploadedLinks,
//         folderType,
//         requiresClientReview: client.requiresClientReview,
//         status: client.requiresVideographer
//           ? "VIDEOGRAPHER_ASSIGNED"
//           : "PENDING",
//       },
//     });

//     await createAuditLog({
//       userId: userId,
//       action: AuditAction.TASK_CREATED,
//       entity: 'Task',
//       entityId: task.id,
//       details: `Created task: ${task.title}`,
//       metadata: {
//         taskId: task.id,
//         assignedTo: assignedTo,
//         status: task.status
//       },
//     });

//     // 📤 UPLOAD FILES TO S3 (into the month folder for raw footage)
//     for (const file of files) {
//       const buffer = Buffer.from(await file.arrayBuffer());

//       const uploaded = await uploadBufferToS3({
//         buffer,
//         folderPrefix, // This already includes the month folder for raw footage
//         filename: file.name,
//         mimeType: file.type,
//       });

//       uploadedLinks.push(uploaded.url);

//       await prisma.file.create({
//         data: {
//           taskId: task.id,
//           name: file.name,
//           url: uploaded.url,
//           mimeType: file.type,
//           size: BigInt(buffer.length),
//           uploadedBy: decoded.userId,
//         },
//       });
//     }

//     // 🆙 UPDATE TASK WITH FILE LINKS
//     await prisma.task.update({
//       where: { id: task.id },
//       data: { driveLinks: uploadedLinks },
//     });

//     // 🔁 AUTO GENERATE TASKS
//     console.log("generateMonthlyTasksFromTemplate");
//     await generateMonthlyTasksFromTemplate(task.id, monthlyDeliverableId);

//     return NextResponse.json(task, { status: 201 });
//   } catch (err: any) {
//     console.error("❌ Create task error:", err);
//     return NextResponse.json(
//       { message: "Server error", error: err.message },
//       { status: 500 }
//     );
//   }
// }




export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import "@/lib/bigint-fix";
import { prisma } from "@/lib/prisma";
import { uploadBufferToS3, addSignedUrlsToFiles } from "@/lib/s3";
import { TaskStatus } from "@prisma/client";
import { ClientRequest } from "http";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateMonthlyTasksFromTemplate } from "@/lib/recurring/generateMonthly";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';

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

function getCurrentMonthFolder(): string {
  const date = new Date();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${month}-${year}`;
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
    return {};
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
              in: [TaskStatus.READY_FOR_QC, TaskStatus.COMPLETED, TaskStatus.REJECTED],
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

const WEEKDAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export async function GET(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const statusFilter = searchParams.get("status") as string | null;
    const clientIdFilter = searchParams.get("clientId") as string | null; // 🔥 NEW: Client filter

    // Build role-based where query
    let where: any = buildRoleWhereQuery(role, Number(userId));

    // 🔥 ADD CLIENT FILTER - For filtering tasks by client
    if (clientIdFilter) {
      if (where.AND) {
        where.AND.push({ clientId: clientIdFilter });
      } else if (Object.keys(where).length > 0) {
        where = {
          AND: [where, { clientId: clientIdFilter }],
        };
      } else {
        where = { clientId: clientIdFilter };
      }
    }

    // 🔥 ADD STATUS FILTER - ALLOW COMMA SEPARATED STATUSES
    const ALLOWED_STATUSES = ["READY_FOR_QC", "COMPLETED", "REJECTED", "PENDING", "IN_PROGRESS", "CLIENT_REVIEW", "SCHEDULED", "VIDEOGRAPHER_ASSIGNED"];

    if (statusFilter) {
      const statuses = statusFilter.split(",").map((s) => s.trim().toUpperCase());

      // Validate that all requested statuses are in allowed list
      const invalidStatuses = statuses.filter((s) => !ALLOWED_STATUSES.includes(s));
      if (invalidStatuses.length > 0) {
        return NextResponse.json(
          { message: `Invalid status: ${invalidStatuses.join(", ")}. Allowed: ${ALLOWED_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }

      if (where.AND) {
        // If AND already exists, add status filter to it
        where.AND.push({
          status: {
            in: statuses,
          },
        });
      } else {
        // Create AND with status filter
        where = {
          AND: [
            where,
            {
              status: {
                in: statuses,
              },
            },
          ],
        };
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      // take: limit,
      // skip: (page - 1) * limit,
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
        files: {
          select: {
            id: true,
            name: true,
            url: true,
            s3Key: true,
            mimeType: true,
            size: true,
            uploadedAt: true,
            uploadedBy: true,
            folderType: true,
            version: true,
          },
        },
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
        // files: true,
        monthlyDeliverableId: true,
        monthlyDeliverable: true,
        socialMediaLinks: true,
        // 🔥 Task feedback temporarily removed - will be re-enabled after Prisma client regeneration
        // taskFeedback: {
        //   select: {
        //     id: true,
        //     fileId: true,
        //     folderType: true,
        //     feedback: true,
        //     status: true,
        //     timestamp: true,
        //     category: true,
        //     createdAt: true,
        //     resolvedAt: true,
        //     file: {
        //       select: {
        //         version: true,
        //         name: true,
        //       },
        //     },
        //   },
        //   orderBy: { createdAt: 'desc' as const },
        // },
      },
    });

    // const sortedTasks = tasks.sort((a, b) => {
    //   const extractNumber = (title: string | null) => {
    //     if (!title) return 0;
    //     const match = title.match(/(\d+)$/); // Get trailing number
    //     return match ? parseInt(match[1], 10) : 0;
    //   };
    //   return extractNumber(a.title) - extractNumber(b.title);
    // });

    const extractSortParts = (title: string | null) => {
      if (!title) return { company: '', date: '', prefix: '', number: 0 };

      // Match: CompanyName_DD-MM-YYYY_TypeNumber
      // Example: CoinLaundryAssociation_01-12-2026_LF1
      const match = title.match(/^(.+)_(\d{2}-\d{2}-\d{4})_([a-zA-Z]+)(\d+)$/);

      if (match) {
        return {
          company: match[1].toLowerCase(),           // "coinlaundryassociation"
          date: match[2],                            // "01-12-2026"
          prefix: match[3].toLowerCase(),            // "lf", "sf", "sqf"
          number: parseInt(match[4], 10)             // 1, 2, 3...
        };
      }

      return { company: title.toLowerCase(), date: '', prefix: '', number: 0 };
    };

    // Sort: company → date → prefix → number
    const sortedTasks = tasks.sort((a, b) => {
      const taskA = extractSortParts(a.title);
      const taskB = extractSortParts(b.title);

      // 1. Sort by company name
      if (taskA.company !== taskB.company) {
        return taskA.company.localeCompare(taskB.company);
      }

      // 2. Sort by date (DD-MM-YYYY format)
      if (taskA.date !== taskB.date) {
        // Convert to comparable format YYYYMMDD for proper date sorting
        const dateA = taskA.date.split('-').reverse().join('');
        const dateB = taskB.date.split('-').reverse().join('');
        return dateA.localeCompare(dateB);
      }

      // 3. Sort by type prefix (LF before SF, etc.)
      if (taskA.prefix !== taskB.prefix) {
        return taskA.prefix.localeCompare(taskB.prefix);
      }

      // 4. Sort by number
      return taskA.number - taskB.number;
    });

    // // ✅ NO COUNT QUERY - just return tasks
    // 🔥 ADD SIGNED URLs TO ALL TASK FILES
    const tasksWithSignedUrls = await Promise.all(
      sortedTasks.map(async (task) => {
        if (task.files && task.files.length > 0) {
          const filesWithSignedUrls = await addSignedUrlsToFiles(task.files);
          return {
            ...task,
            files: filesWithSignedUrls,
          };
        }
        return task;
      })
    );

    // ✅ Return tasks with signed URLs
    return NextResponse.json({ tasks: tasksWithSignedUrls }, { status: 200 });
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


    if (!assignedTo || !clientId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Default folderType to rawFootage if not provided
    const effectiveFolderType = folderType || 'rawFootage';

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

    if (effectiveFolderType === "rawFootage") {
      const companyName = client.companyName || client.name;
      const currentMonth = getCurrentMonthFolder();
      const rawFootageBase = client.rawFootageFolderId || `${companyName}/raw-footage/`;
      folderPrefix = `${rawFootageBase}${currentMonth}/`;

      try {
        await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: folderPrefix,
            ContentType: "application/x-directory",
          })
        );
        console.log('✅ Month folder ensured:', folderPrefix);
      } catch (error) {
        console.log('⚠️ Folder might already exist (ok):', error);
      }

    } else {
      folderPrefix = client.essentialsFolderId || '';
    }

    if (!folderPrefix) {
      return NextResponse.json(
        { message: `Missing folder for ${folderType}` },
        { status: 400 }
      );
    }

    const uploadedLinks: string[] = [];
    const files = form.getAll("files") as File[];

    // 📝 CREATE TASK FIRST
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
        folderType: effectiveFolderType,
        requiresClientReview: client.requiresClientReview,
        status: client.requiresVideographer
          ? "VIDEOGRAPHER_ASSIGNED"
          : "PENDING",
      },
    });

    console.log("Created task:", JSON.stringify(task));

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
    await generateMonthlyTasksFromTemplate(task.id, monthlyDeliverableId);

    return NextResponse.json(task, { status: 201 });
  } catch (err: any) {
    console.error("❌ Create task error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}