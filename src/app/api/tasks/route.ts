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

// const buildRoleWhereQuery = (role: string | null, userId: number): any => {
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
// import { TaskStatus } from "@prisma/client";
import { ClientRequest } from "http";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateMonthlyTasksFromTemplate } from "@/lib/recurring/generateMonthly";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
import { notifyUser } from "@/lib/notify";
import { getCurrentUser2, resolveClientIdForUser } from "@/lib/auth";

import { getS3, BUCKET, getFileUrl } from "@/lib/s3";

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

const s3Client = getS3();

function getCurrentMonthFolder(): string {
  const date = new Date();
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  const year = date.getFullYear();
  return `${month}-${year}`;
}

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
  monthFolder?: string
): Promise<string> {
  // Monthly grouped path: CompanyName/outputs/Month-Year/TaskTitle/
  const outputBase = monthFolder
    ? `${companyName}/outputs/${monthFolder}/`
    : `${companyName}/outputs/`;
  const taskFolderPath = `${outputBase}${taskTitle}/`;

  await Promise.all([
    ...(monthFolder ? [s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: outputBase,
      ContentType: "application/x-directory",
    }))] : []),
    s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: taskFolderPath,
      ContentType: "application/x-directory",
    })),
    s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${taskFolderPath}thumbnails/`,
      ContentType: "application/x-directory",
    })),
    s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${taskFolderPath}tiles/`,
      ContentType: "application/x-directory",
    })),
    s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${taskFolderPath}music-license/`,
      ContentType: "application/x-directory",
    }))
  ]);

  return taskFolderPath;
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

function sanitizeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj.toISOString(); // ✅ Serialize dates as ISO strings
  if (Array.isArray(obj)) return obj.map(sanitizeBigInt);
  if (typeof obj === "object") {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = sanitizeBigInt(obj[key]);
    }
    return newObj;
  }
  return obj;
}

const buildRoleWhereQuery = async (role: string | null, userId: number): Promise<any> => {
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
                "PENDING",
                "IN_PROGRESS",
                "READY_FOR_QC",
                "REJECTED",
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
              in: ["READY_FOR_QC", "COMPLETED", "REJECTED", "CLIENT_REVIEW"],
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
              in: ["COMPLETED", "SCHEDULED"],
            },
          },
        ],
      };

    case "client": {
      // 🔥 FIX: Resolve the actual clientId (via linkedClientId or fallback)
      // so ALL users linked to the same client see the same tasks
      const resolvedClientId = await resolveClientIdForUser(userId);

      if (resolvedClientId) {
        // Filter by clientId — all users linked to this client see the same tasks
        return {
          AND: [
            { clientId: resolvedClientId },
            {
              status: {
                in: ["CLIENT_REVIEW", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "POSTED"],
              },
            },
          ],
        };
      }

      // Fallback: if no client link found, use old clientUserId filter (safety net)
      return {
        AND: [
          { clientUserId: Number(userId) },
          {
            status: {
              in: ["CLIENT_REVIEW", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "POSTED"],
            },
          },
        ],
      };
    }

    case "videographer":
      return {
        AND: [
          { videographer: userId },
          {
            status: {
              in: ["VIDEOGRAPHER_ASSIGNED"],
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



export async function GET(req: any) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId } = user;

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") as string | null;
    const clientIdFilter = searchParams.get("clientId") as string | null;
    const monthFilter = searchParams.get("month") as string | null;

    // Build role-based where query
    let where: any = await buildRoleWhereQuery(role, Number(userId));

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
    const ALLOWED_STATUSES = ["READY_FOR_QC", "COMPLETED", "REJECTED", "PENDING", "IN_PROGRESS", "CLIENT_REVIEW", "SCHEDULED", "VIDEOGRAPHER_ASSIGNED", "POSTED"];

    if (statusFilter) {
      const statuses = statusFilter.split(",").map((s) => s.trim().toUpperCase());

      const invalidStatuses = statuses.filter((s) => !ALLOWED_STATUSES.includes(s));
      if (invalidStatuses.length > 0) {
        return NextResponse.json(
          { message: `Invalid status: ${invalidStatuses.join(", ")}. Allowed: ${ALLOWED_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }

      if (where.AND) {
        where.AND.push({
          status: {
            in: statuses,
          },
        });
      } else {
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

    // 🔥 ADD MONTH FILTER - Filter by monthFolder (e.g., "March-2026")
    if (monthFilter && monthFilter !== "all") {
      if (where.AND) {
        where.AND.push({ monthFolder: monthFilter });
      } else if (Object.keys(where).length > 0) {
        where = {
          AND: [where, { monthFolder: monthFilter }],
        };
      } else {
        where = { monthFolder: monthFilter };
      }
    }

    let tasks: any[];
    try {
      // ✅ NO PAGINATION - Fetch all tasks matching the query
      tasks = await (prisma.task as any).findMany({
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
              isActive: true,
              codec: true,
              proxyUrl: true,
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
          monthFolder: true,
          qcNotes: true,
          feedback: true,
          shootDetail: true,
          deliverableType: true,
          monthlyDeliverableId: true,
          monthlyDeliverable: true,
          oneOffDeliverableId: true,
          oneOffDeliverable: true,
          socialMediaLinks: true,
          updatedAt: true,
          client: {
            select: {
              name: true,
              companyName: true,
            }
          },
          user: {
            select: {
              name: true,
              role: true,
            },
          },
          qcReviewedBy: true,
          qcReviewedAt: true,
          qcResult: true,
          qcReviewer: {
            select: {
              id: true,
              name: true,
            },
          },
          taskFeedback: {
            select: {
              id: true,
              fileId: true,
              folderType: true,
              feedback: true,
              status: true,
              timestamp: true,
              category: true,
              createdAt: true,
              resolvedAt: true,
              file: {
                select: {
                  version: true,
                  name: true,
                },
              },
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' as const },
          },
        },
      });
    } catch (e: any) {
      if (e.message?.includes("Expected TaskStatus") || e.code === "P2009" || e.message?.includes("validation")) {
        console.warn("⚠️ findMany failed due to enum mismatch. Falling back to queryRaw...");
        tasks = await prisma.$queryRawUnsafe(`
          SELECT t.*, 
                 c.name as "clientName", c."companyName" as "clientCompanyName",
                 u.name as "userName", u.role as "userRole"
          FROM "Task" t
          LEFT JOIN "Client" c ON t."clientId" = c.id
          LEFT JOIN "User" u ON t."assignedTo" = u.id
          ORDER BY t."createdAt" DESC
        `);

        const taskIds = (tasks as any[]).map(t => t.id);
        const allFiles: any[] = taskIds.length > 0
          ? await prisma.$queryRawUnsafe(`SELECT * FROM "File" WHERE "taskId" IN (${taskIds.map(id => `'${id}'`).join(',')})`)
          : [];

        tasks = tasks.map(t => ({
          ...t,
          client: { name: t.clientName, companyName: t.clientCompanyName },
          user: { name: t.userName, role: t.userRole },
          files: allFiles.filter(f => f.taskId === t.id),
          taskFeedback: []
        }));
      } else {
        throw e;
      }
    }

    const extractSortParts = (title: string | null) => {
      if (!title) return { company: '', date: '', prefix: '', number: 0 };

      const match = title.match(/^(.+)_(\d{2}-\d{2}-\d{4})_([a-zA-Z]+)(\d+)$/);

      if (match) {
        return {
          company: match[1].toLowerCase(),
          date: match[2],
          prefix: match[3].toLowerCase(),
          number: parseInt(match[4], 10)
        };
      }

      return { company: title.toLowerCase(), date: '', prefix: '', number: 0 };
    };

    // Sort: company → date → prefix → number
    const sortedTasks = tasks.sort((a: any, b: any) => {
      const taskA = extractSortParts(a.title);
      const taskB = extractSortParts(b.title);

      if (taskA.company !== taskB.company) {
        return taskA.company.localeCompare(taskB.company);
      }

      if (taskA.date !== taskB.date) {
        const dateA = taskA.date.split('-').reverse().join('');
        const dateB = taskB.date.split('-').reverse().join('');
        return dateA.localeCompare(dateB);
      }

      if (taskA.prefix !== taskB.prefix) {
        return taskA.prefix.localeCompare(taskB.prefix);
      }

      return taskA.number - taskB.number;
    });

    // ✅ Add signed URLs to files
    const tasksWithSignedUrls = await Promise.all(
      sortedTasks.map(async (task) => {
        if (task.files && task.files.length > 0) {
          const signedFiles = await addSignedUrlsToFiles(task.files);
          return { ...task, files: signedFiles };
        }
        return task;
      })
    );

    // 🔥 Get distinct monthFolder values for the filter dropdown
    const distinctMonths = await prisma.task.findMany({
      where: { monthFolder: { not: null } },
      select: { monthFolder: true },
      distinct: ['monthFolder'],
      orderBy: { monthFolder: 'desc' },
    });
    const availableMonths = distinctMonths
      .map((t: any) => t.monthFolder as string)
      .filter(Boolean);

    // ✅ Return all tasks without pagination
    return NextResponse.json({
      tasks: sanitizeBigInt(tasksWithSignedUrls),
      availableMonths,
    }, { status: 200 });
  } catch (err: any) {
    console.error("❌ GET /api/tasks error:", err);
    return NextResponse.json(
      {
        message: "Server error",
        error: err.message,
        stack: err.stack,
        details: err.code === 'P2009' ? 'Query validation error' : 'Unknown Prisma error'
      },
      { status: 500 }
    );
  }
}

export async function POST(req: any) {
  try {
    // 🔒 AUTH
    const user = await getCurrentUser2(req);
    if (!user)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { role, id: userId } = user;

    // 🔒 Editors can only create tasks if explicitly permitted for the target client
    const isEditorCreate = role?.toLowerCase() === 'editor';

    if (!role || (!["admin", "manager"].includes(role.toLowerCase()) && !isEditorCreate)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // 📝 Read FormData
    const form = await req.formData();

    const description = form.get("description") as string;
    const dueDate = form.get("dueDate") as string;
    // Editors are always assigned to themselves; admins read from form
    const assignedTo = isEditorCreate ? Number(userId) : Number(form.get("assignedTo"));
    const qc_specialist = isEditorCreate ? 28 : Number(form.get("qc_specialist"));
    const scheduler = isEditorCreate ? 23 : Number(form.get("scheduler"));
    const videographer = isEditorCreate ? 0 : Number(form.get("videographer"));
    const clientId = form.get("clientId") as string;
    const folderType = form.get("folderType") as string;
    const monthlyDeliverableId = isEditorCreate ? '' : (form.get("monthlyDeliverableId") as string);
    const oneOffDeliverableId = form.get("oneOffDeliverableId") as string;

    // 🔥 EDITOR PERMISSION CHECK
    if (isEditorCreate) {
      if (!clientId || !oneOffDeliverableId) {
        return NextResponse.json({ message: "clientId and oneOffDeliverableId are required" }, { status: 400 });
      }
      const perm = await (prisma as any).editorClientPermission.findUnique({
        where: { editorId_clientId: { editorId: Number(userId), clientId } },
      });
      if (!perm) {
        return NextResponse.json({ message: "You do not have permission to create tasks for this client" }, { status: 403 });
      }
    }

    // 🔥 SHOOT SPECIFIC FIELDS
    const shootLocation = form.get("shootLocation") as string;
    const shootDate = form.get("shootDate") as string;
    const shootCamera = form.get("shootCamera") as string;
    const shootQuality = form.get("shootQuality") as string;
    const shootFrameRate = form.get("shootFrameRate") as string;
    const shootLighting = form.get("shootLighting") as string;
    const shootExclusions = form.get("shootExclusions") as string;
    const shootReferenceLinks = form.get("shootReferenceLinks") as string;

    if (!isEditorCreate && (!assignedTo || !clientId)) {
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
            Bucket: BUCKET,
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

    if (!folderPrefix && !isEditorCreate) {
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
        createdBy: userId,
        clientId: clientId,
        clientUserId: client?.userId,
        monthlyDeliverableId: monthlyDeliverableId || null,
        oneOffDeliverableId: oneOffDeliverableId || null,
        driveLinks: uploadedLinks,
        folderType: effectiveFolderType,
        monthFolder: getCurrentMonthFolder(),
        requiresClientReview: client.requiresClientReview,
        status: (client.requiresVideographer || shootLocation || shootCamera)
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

    // 🔔 Notify the assigned editor
    try {
      await notifyUser({
        userId: assignedTo,
        type: "task_assigned",
        title: "New Task Assigned",
        body: `You have been assigned a new task: ${task.title || "Untitled"}`,
        payload: { taskId: task.id, clientId: task.clientId }
      });
    } catch (err) {
      console.error("Failed to send assignment notification:", err);
    }

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
          uploadedBy: userId,
        },
      });
    }

    // 🆙 UPDATE TASK WITH FILE LINKS
    await prisma.task.update({
      where: { id: task.id },
      data: { driveLinks: uploadedLinks },
    });

    // 🔥 CREATE SHOOT DETAIL IF PROVIDED
    if (shootLocation || shootDate || shootCamera || shootReferenceLinks) {
      const referenceLinksArray = shootReferenceLinks
        ? shootReferenceLinks.split(',').map(l => l.trim()).filter(Boolean)
        : [];

      await (prisma as any).shootDetail.create({
        data: {
          taskId: task.id,
          location: shootLocation || null,
          shootDate: shootDate ? new Date(shootDate) : null,
          camera: shootCamera || null,
          quality: shootQuality || null,
          frameRate: shootFrameRate || null,
          lighting: shootLighting || null,
          exclusions: shootExclusions || null,
          referenceLinks: referenceLinksArray,
          videographerId: videographer || null
        }
      });
    }

    // 🔁 AUTO GENERATE TASKS (Only if it's a monthly deliverable)
    if (monthlyDeliverableId) {
      await generateMonthlyTasksFromTemplate(task.id, monthlyDeliverableId);
    } else if (oneOffDeliverableId) {
      // 🔥 HANDLE ONE-OFF TASK NAMING AND FOLDERS
      const deliverable = await prisma.oneOffDeliverable.findUnique({
        where: { id: oneOffDeliverableId }
      });

      if (deliverable) {
        // 🔥 Count existing tasks for this deliverable to get the next number
        const existingCount = await prisma.task.count({
          where: {
            clientId,
            oneOffDeliverableId: deliverable.id,
          }
        });

        const companyName = client.companyName || client.name;
        const companyNameSlug = companyName.replace(/\s/g, '');
        const deliverableSlug = getDeliverableShortCode(deliverable.type);
        const createdAtStr = formatDateMMDDYYYY(task.createdAt);
        // existingCount already includes the current task
        const title = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${existingCount}`;

        // Create folder structure (grouped by month)
        const currentMonth = getCurrentMonthFolder();
        const taskFolderPath = await createTaskFolderStructure(companyName, title, currentMonth);

        // Update task with title and folder
        const updatedOneOff = await prisma.task.update({
          where: { id: task.id },
          data: {
            title,
            outputFolderId: taskFolderPath
          }
        });

        console.log(`✅ One-off task updated: ${title}`);

        // 🔥 NOTIFY CLIENT SLACK CHANNEL (Editor One-off only)
        if (isEditorCreate) {
          const editorName = user.name || user.email;
          const clientName = client.name;

          await notifyUser({
            userId: null,
            type: "task_created",
            title: "New Task Created",
            body: `${editorName} has created a task for ${clientName}`,
            payload: {
              taskId: task.id,
              clientId: clientId
            }
          });
        }

        return NextResponse.json(updatedOneOff, { status: 201 });
      }
    }

    // For monthly tasks, we should fetch the task again as generateMonthlyTasksFromTemplate updates it
    if (monthlyDeliverableId) {
      const updatedMonthly = await prisma.task.findUnique({
        where: { id: task.id }
      });
      return NextResponse.json(updatedMonthly || task, { status: 201 });
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
