export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import "@/lib/bigint-fix";
import { getDbHttp } from "@/lib/db";
import {
  task as taskTable,
  client as clientTable,
  user as userTable,
  monthlyDeliverable as monthlyDeliverableTable,
  oneOffDeliverable as oneOffDeliverableTable,
  shootDetail as shootDetailTable,
  editorClientPermission as editorClientPermissionTable,
  file as fileTable,
} from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, or, eq, inArray, isNull, isNotNull, ne, desc, count, getTableColumns, sql as drizzleSql } from "drizzle-orm";
import { uploadBufferToS3, addSignedUrlsToFiles } from "@/lib/s3";
// import { TaskStatus } from "@prisma/client";
import { ClientRequest } from "http";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateMonthlyTasksFromTemplate } from "@/lib/recurring/generateMonthly";
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
import { notifyUser, notifyEditorTaskAssignment } from "@/lib/notify";
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
  if (normalized === "stories") return "ST";
  if (normalized === "text post") return "TP";
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

const buildRoleWhereQuery = async (role: string | null, userId: number, clientIdOverride?: string | null) => {
  if (!role) {
    return undefined;
  }

  switch (role.toLowerCase()) {
    case "editor":
      return and(
        eq(taskTable.assignedTo, userId),
        inArray(taskTable.status, ["PENDING", "IN_PROGRESS", "READY_FOR_QC", "REJECTED"] as any)
      );

    case "qc":
      return and(
        eq(taskTable.qcSpecialist, userId),
        inArray(taskTable.status, ["READY_FOR_QC", "COMPLETED", "REJECTED", "CLIENT_REVIEW"] as any)
      );

    case "scheduler":
      // Schedulers see tasks assigned to them OR unassigned tasks (scheduler: null)
      return and(
        or(eq(taskTable.scheduler, userId), isNull(taskTable.scheduler)),
        inArray(taskTable.status, ["COMPLETED", "SCHEDULED"] as any)
      );

    case "client": {
      // 🔥 FIX: Resolve the actual clientId (via linkedClientId or fallback)
      // so ALL users linked to the same client see the same tasks.
      //
      // clientIdOverride: used when an admin/manager is previewing a
      // SPECIFIC client's portal via the switch-role dropdown (e.g. eric
      // viewing "The Drew Meyers"). The admin's own userId has no real
      // client link, so resolveClientIdForUser(userId) would fail — the
      // caller passes the target client's ID explicitly instead, already
      // authorized upstream in GET() before this function is called.
      const resolvedClientId = clientIdOverride || (await resolveClientIdForUser(userId));
      const clientStatuses = ["CLIENT_REVIEW", "IN_PROGRESS", "SCHEDULED", "COMPLETED", "POSTED", "REJECTED"] as any;

      if (resolvedClientId) {
        // Filter by clientId — all users linked to this client see the same tasks
        return and(eq(taskTable.clientId, resolvedClientId), inArray(taskTable.status, clientStatuses));
      }

      // Fallback: if no client link found, use old clientUserId filter (safety net)
      return and(eq(taskTable.clientUserId, Number(userId)), inArray(taskTable.status, clientStatuses));
    }

    case "videographer":
      return and(
        eq(taskTable.videographer, userId),
        inArray(taskTable.status, ["VIDEOGRAPHER_ASSIGNED"] as any)
      );

    case "manager":
    case "admin":
      return undefined;

    default:
      return eq(taskTable.assignedTo, userId);
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
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId, roles: userRoles, email: userEmail } = user;

// 🔥 Role-switch support: if this account is legitimately viewing as another
// role it's authorized for, use that role to build the query instead of the
// header alone. Mirrors the frontend's authorization in ViewAsRoleContext.tsx
// (real roles[], the legacy grandfather emails, and admins) instead of
// trusting whatever x-viewing-as the client sends — previously any role
// could set that header and get treated as "admin"-level QC access.
const LEGACY_ROLE_SWITCH_EMAILS = new Set([
  "eric@e8productions.com",
  "sahilsagvekar230@gmail.com",
]);
const DEFAULT_ADMIN_SWITCH_ROLES = ["qc", "sales", "sales_manager", "scheduler"];

const baseRole = role?.toLowerCase() || null;
const viewingAs = req.headers.get("x-viewing-as")?.toLowerCase() || null;

const authorizedSwitchRoles = new Set<string>([
  ...(Array.isArray(userRoles) ? userRoles.map((r: string) => r.toLowerCase()) : []),
  ...(userEmail && LEGACY_ROLE_SWITCH_EMAILS.has(userEmail.toLowerCase())
    ? DEFAULT_ADMIN_SWITCH_ROLES
    : []),
  ...(baseRole === "admin" ? DEFAULT_ADMIN_SWITCH_ROLES : []),
  // 🔥 "client" is deliberately NOT in DEFAULT_ADMIN_SWITCH_ROLES above —
  // unlike qc/sales/scheduler, previewing "client" needs a specific target
  // client, not just the role name. Any admin/manager MAY switch into it,
  // but only once they also supply ?clientId= (see below) — the frontend
  // only offers this via ViewAsRoleContext's CLIENT_PREVIEW_MAP, which is
  // scoped per-email, so in practice only accounts explicitly granted a
  // client to preview will ever send this combination.
  ...((baseRole === "admin" || baseRole === "manager") ? ["client"] : []),
]);

const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") as string | null;
    const clientIdFilter = searchParams.get("clientId") as string | null;
    const monthFilter = searchParams.get("monthFolder") as string | null;

// Viewing as QC (from any authorized base role — editor, scheduler, etc.)
// is treated as admin-level access so the viewer sees ALL QC tasks, not
// just tasks assigned to them personally in their normal role. Viewing as
// "client" additionally requires a clientId — without one there's no
// client to scope to, so it's ignored and the real role is used instead.
const effectiveRole =
  viewingAs && viewingAs !== baseRole && authorizedSwitchRoles.has(viewingAs) && (viewingAs !== "client" || !!clientIdFilter)
    ? (viewingAs === "qc" ? "admin" : viewingAs)
    : role;

    // 🔥 Row-count safety cap — default 100, caller can request more via
    // ?limit=, but never more than 200 (prevents ?limit=99999 from
    // recreating the unfiltered-3000+-rows memory problem this replaces).
    const requestedLimit = parseInt(searchParams.get("limit") || "", 10);
    const taskLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 200)
      : 100;

    // Build role-based where query. When previewing "client", pass the
    // requested clientId through as the override (see buildRoleWhereQuery) —
    // for a real client user this is undefined and it falls back to
    // resolveClientIdForUser as before.
    const roleWhere = await buildRoleWhereQuery(
      effectiveRole,
      Number(userId),
      effectiveRole === "client" ? clientIdFilter : undefined
    );
    const conditions: any[] = roleWhere ? [roleWhere] : [];

    // 🔥 ADD CLIENT FILTER - For filtering tasks by client. Skipped when
    // effectiveRole is already "client", since buildRoleWhereQuery just
    // applied the same clientId scoped to client-visible statuses only —
    // adding it again here would be redundant and (harmlessly) duplicate
    // the condition.
    if (clientIdFilter && effectiveRole !== "client") {
      conditions.push(eq(taskTable.clientId, clientIdFilter));
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

      conditions.push(inArray(taskTable.status, statuses as any));
    }

    // 🔥 ADD MONTH FILTER - Filter by monthFolder (e.g., "March-2026")
    if (monthFilter && monthFilter !== "all") {
      conditions.push(eq(taskTable.monthFolder, monthFilter));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    let tasks: any[];
    try {
      // ✅ NO PAGINATION - Fetch all tasks matching the query
      const rawTasks = await db.query.task.findMany({
        where,
        orderBy: desc(taskTable.createdAt),
        limit: taskLimit,
        columns: {
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
          monthFolder: true,
          qcNotes: true,
          feedback: true,
          deliverableType: true,
          textContent: true,
          monthlyDeliverableId: true,
          oneOffDeliverableId: true,
          isExtra: true,
          extraSequence: true,
          socialMediaLinks: true,
          suggestedTitles: true,
          postingTitle: true,
          titleSetByQc: true,
          titleSetByClient: true,
          postingTitles: true,
          postingDescriptions: true,
          postingTags: true,
          updatedAt: true,
          qcReviewedBy: true,
          qcReviewedAt: true,
          qcResult: true,
        },
        with: {
          files: {
            columns: {
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
              reviewDriveUrl: true,
              youtubeVideoId: true,
            },
          },
          shootDetails: true,
          monthlyDeliverable: true,
          oneOffDeliverable: true,
          tagToTasks: { with: { tag: true } },
          client: {
            columns: {
              name: true,
              companyName: true,
              requiresClientReview: true,
              clientReviewDeliverableTypes: true,
            }
          },
          user_assignedTo: {
            columns: {
              name: true,
              role: true,
            },
          },
          user_qcReviewedBy: {
            columns: {
              id: true,
              name: true,
            },
          },
          taskFeedbacks: {
            columns: {
              id: true,
              fileId: true,
              folderType: true,
              feedback: true,
              status: true,
              timestamp: true,
              category: true,
              createdAt: true,
              resolvedAt: true,
              acknowledgedAt: true,
              acknowledgedBy: true,
            },
            with: {
              file: {
                columns: {
                  version: true,
                  name: true,
                },
              },
              user: {
                columns: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: (tf, { desc }) => desc(tf.createdAt),
          },
        },
      });

      // Rename relation keys back to the shape the rest of this handler
      // (and the frontend) expects, since Drizzle's relational query API
      // keys results by the relation name in relations.ts, not the FK name.
      tasks = rawTasks.map((t: any) => {
        const { user_assignedTo, user_qcReviewedBy, taskFeedbacks, shootDetails, tagToTasks, ...rest } = t;
        return {
          ...rest,
          user: user_assignedTo,
          qcReviewer: user_qcReviewedBy,
          taskFeedback: taskFeedbacks,
          shootDetail: shootDetails?.[0] ?? null,
          tags: (tagToTasks ?? []).map((tt: any) => tt.tag),
        };
      });
    } catch (e: any) {
      console.warn("⚠️ Structured task query failed, falling back to raw SQL...", e.message);

      // 🔒 IMPORTANT: this fallback used to run a completely unscoped
      // `SELECT t.* ... LIMIT` with no WHERE clause at all — it ignored the
      // same `where` (role + status + client + month filters) built above.
      // For an editor, that meant the global most-recent-N tasks across the
      // ENTIRE company, almost never including her own — the dashboard
      // rendered "No tasks" everywhere until a reload retried the primary
      // query. For a client session, the same gap meant potentially seeing
      // other clients' unscoped task rows. Always reuse `where` here so a
      // fallback degrades gracefully instead of silently changing scope.
      const rawRows = await db
        .select({
          ...getTableColumns(taskTable),
          clientName: clientTable.name,
          clientCompanyName: clientTable.companyName,
          userName: userTable.name,
          userRole: userTable.role,
        })
        .from(taskTable)
        .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
        .leftJoin(userTable, eq(taskTable.assignedTo, userTable.id))
        .where(where)
        .orderBy(desc(taskTable.createdAt))
        .limit(taskLimit);

      const taskIds = rawRows.map(t => t.id);
      const allFiles: any[] = taskIds.length > 0
        ? await db.select().from(fileTable).where(inArray(fileTable.taskId, taskIds))
        : [];

      tasks = rawRows.map(t => ({
        ...t,
        client: { name: t.clientName, companyName: t.clientCompanyName },
        user: { name: t.userName, role: t.userRole },
        files: allFiles.filter(f => f.taskId === t.id),
        taskFeedback: []
      }));
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

    // 🔥 Recompute requiresClientReview per-task instead of trusting the
    // creation-time snapshot stored on the Task row.
    //
    // `task.requiresClientReview` is a blanket copy of `client.requiresClientReview`
    // taken when the task was created — it doesn't account for
    // `client.clientReviewDeliverableTypes` (the per-deliverable-type allow-list).
    // For clients using that selective/type-restricted setup, every task was
    // getting `requiresClientReview: true` regardless of its actual type, which
    // hid the QC "send to client review anyway" checkbox for deliverable types
    // that were never actually going to be auto-routed to review.
    //
    // This mirrors the eligibility check in /api/tasks/[id]/status so the QC
    // screen's checkbox visibility matches the real approval-time routing.
    const DELIVERABLE_SHORT_CODES: Record<string, string> = {
      "short form videos": "SF",
      "long form videos": "LF",
      "square form videos": "SQF",
      "thumbnails": "THUMB",
      "tiles": "T",
      "hard posts / graphic images": "HP",
      "snapchat episodes": "SEP",
      "beta short form": "BSF",
      "stories": "ST",
      "text post": "TP",
    };

    const tasksWithEffectiveReview = tasksWithSignedUrls.map((task: any) => {
      const client = task.client;
      if (!client?.requiresClientReview) {
        return { ...task, requiresClientReview: false };
      }

      const allowedTypes: string[] = client.clientReviewDeliverableTypes ?? [];
      // No types configured → applies to every deliverable (backwards compatible).
      if (allowedTypes.length === 0) {
        return { ...task, requiresClientReview: true };
      }

      const rawDeliverableType: string =
        task.monthlyDeliverable?.type || task.oneOffDeliverable?.type || "";
      const fallbackShortCode =
        DELIVERABLE_SHORT_CODES[rawDeliverableType.toLowerCase().trim()] || rawDeliverableType;
      const taskType: string = task.deliverableType || fallbackShortCode || "";

      return { ...task, requiresClientReview: allowedTypes.includes(taskType) };
    });

    // 🔥 Get distinct monthFolder values for the filter dropdown
    const distinctMonths = await db
      .selectDistinct({ monthFolder: taskTable.monthFolder })
      .from(taskTable)
      .where(isNotNull(taskTable.monthFolder))
      .orderBy(desc(taskTable.monthFolder));
    const availableMonths = distinctMonths
      .map((t: any) => t.monthFolder as string)
      .filter(Boolean);

    // ✅ Return all tasks without pagination
    // return NextResponse.json({
    //   tasks: sanitizeBigInt(tasksWithSignedUrls),
    //   availableMonths,
    // }, { status: 200 });
    // ✅ Return all tasks without pagination
// Strip internal-only title fields from client responses.
// NOTE: postingTitle / titleSetByQC / titleSetByClient are intentionally
// kept for clients — the client review screen shows the QC-set posting
// title and lets the client optionally edit it before it goes to the
// scheduler. Only the internal task `title` and the raw AI `suggestedTitles`
// list (meant for QC only) are stripped.
const isClientRole = role?.toLowerCase() === 'client';
const finalTasks = isClientRole
  ? sanitizeBigInt(tasksWithEffectiveReview).map((t: any) => {
      const { title, suggestedTitles, ...rest } = t;
      return rest;
    })
  : sanitizeBigInt(tasksWithEffectiveReview);

return NextResponse.json({
  tasks: finalTasks,
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
  const db = getDbHttp();
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
    const scheduler = isEditorCreate ? 123 : Number(form.get("scheduler")); // Daena Azineth Loisaga
    const videographer = isEditorCreate ? 0 : Number(form.get("videographer"));
    const clientId = form.get("clientId") as string;
    const folderType = form.get("folderType") as string;
    const isExtra = form.get("isExtra") === "true";
    const extraQuantity = Math.min(
      100,
      Math.max(1, Number(form.get("extraQuantity") || 1) || 1)
    );
    const requestedMonthlyDeliverableId = form.get("monthlyDeliverableId") as string;
    const monthlyDeliverableId = isEditorCreate && !isExtra ? '' : requestedMonthlyDeliverableId;
    const oneOffDeliverableId = form.get("oneOffDeliverableId") as string;

    // 🔥 EDITOR PERMISSION CHECK
    if (isEditorCreate) {
      if (!clientId || (!oneOffDeliverableId && !(isExtra && monthlyDeliverableId))) {
        return NextResponse.json({ message: "clientId and a valid deliverable are required" }, { status: 400 });
      }
      const [perm] = await db.select().from(editorClientPermissionTable)
        .where(and(eq(editorClientPermissionTable.editorId, Number(userId)), eq(editorClientPermissionTable.clientId, clientId)))
        .limit(1);
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
    const [client] = await db.select({
      name: clientTable.name,
      companyName: clientTable.companyName,
      rawFootageFolderId: clientTable.rawFootageFolderId,
      essentialsFolderId: clientTable.essentialsFolderId,
      requiresClientReview: clientTable.requiresClientReview,
      requiresVideographer: clientTable.requiresVideographer,
      isTrial: clientTable.isTrial,
      userId: clientTable.userId,
    }).from(clientTable).where(eq(clientTable.id, clientId)).limit(1);

    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    // 🔥 Determine folder prefix based on folder type
    const currentMonth = getCurrentMonthFolder();
    const isExtraMonthlyTask = Boolean(isExtra && monthlyDeliverableId && !oneOffDeliverableId);
    let extraSequence: number | null = null;
    let extraMonthlyDeliverable: { id: string; type: string } | null = null;

    if (isExtraMonthlyTask) {
      const [md] = await db.select({ id: monthlyDeliverableTable.id, type: monthlyDeliverableTable.type })
        .from(monthlyDeliverableTable)
        .where(and(eq(monthlyDeliverableTable.id, monthlyDeliverableId), eq(monthlyDeliverableTable.clientId, clientId)))
        .limit(1);
      extraMonthlyDeliverable = md ?? null;

      if (!extraMonthlyDeliverable) {
        return NextResponse.json(
          { message: "Monthly deliverable not found for this client" },
          { status: 400 }
        );
      }

      const [{ value: existingMonthlyTaskCount }] = await db.select({ value: count() })
        .from(taskTable)
        .where(and(
          eq(taskTable.clientId, clientId),
          eq(taskTable.monthlyDeliverableId, monthlyDeliverableId),
          eq(taskTable.monthFolder, currentMonth),
        ));
      extraSequence = existingMonthlyTaskCount + 1;
    }

    let folderPrefix = '';

    if (effectiveFolderType === "rawFootage") {
      const companyName = client.companyName || client.name;
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

    // 🔥 Resolve deliverableType short code upfront so it's stamped on every task path
    let resolvedDeliverableType: string | null = null;
    if (isExtraMonthlyTask && extraMonthlyDeliverable) {
      resolvedDeliverableType = getDeliverableShortCode(extraMonthlyDeliverable.type);
    } else if (monthlyDeliverableId) {
      const [mdForType] = await db.select({ type: monthlyDeliverableTable.type })
        .from(monthlyDeliverableTable)
        .where(and(eq(monthlyDeliverableTable.id, monthlyDeliverableId), eq(monthlyDeliverableTable.clientId, clientId)))
        .limit(1);
      if (mdForType) resolvedDeliverableType = getDeliverableShortCode(mdForType.type);
    } else if (oneOffDeliverableId) {
      const [odForType] = await db.select({ type: oneOffDeliverableTable.type })
        .from(oneOffDeliverableTable)
        .where(eq(oneOffDeliverableTable.id, oneOffDeliverableId))
        .limit(1);
      if (odForType) resolvedDeliverableType = getDeliverableShortCode(odForType.type);
    }

    // 📝 CREATE TASK FIRST
    const [task] = await db.insert(taskTable).values({
      id: createId(),
      title: "",
      description: description || "",
      dueDate: new Date(dueDate).toISOString(),
      assignedTo,
      qcSpecialist: qc_specialist,
      scheduler,
      videographer,
      createdBy: userId,
      clientId: clientId,
      clientUserId: client?.userId,
      monthlyDeliverableId: monthlyDeliverableId || null,
      oneOffDeliverableId: oneOffDeliverableId || null,
      driveLinks: uploadedLinks,
      folderType: effectiveFolderType,
      monthFolder: currentMonth,
      requiresClientReview: client.requiresClientReview,
      isTrial: client.isTrial ?? false,
      isExtra: isExtraMonthlyTask,
      extraSequence,
      deliverableType: resolvedDeliverableType,
      status: (client.requiresVideographer || shootLocation || shootCamera)
        ? "VIDEOGRAPHER_ASSIGNED"
        : "PENDING",
      updatedAt: new Date().toISOString(),
    }).returning();

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

    // 🔔 Notification moved to after each branch below sets the real title —
    // see the "🔔 Notify" comments near each return statement. Calling this
    // here (right after insert, when title is still "") is exactly why the
    // Slack "You've been assigned 1 task: Untitled" bug happened: this task
    // row's title isn't filled in until the extra/monthly/one-off title
    // logic runs further down, well after this point.

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

      await db.insert(fileTable).values({
        id: createId(),
        taskId: task.id,
        name: file.name,
        url: uploaded.url,
        mimeType: file.type,
        size: buffer.length,
        uploadedBy: userId,
      });
    }

    // 🆙 UPDATE TASK WITH FILE LINKS
    await db.update(taskTable).set({ driveLinks: uploadedLinks, updatedAt: new Date().toISOString() }).where(eq(taskTable.id, task.id));

    // 🔥 CREATE SHOOT DETAIL IF PROVIDED
    if (shootLocation || shootDate || shootCamera || shootReferenceLinks) {
      const referenceLinksArray = shootReferenceLinks
        ? shootReferenceLinks.split(',').map(l => l.trim()).filter(Boolean)
        : [];

      await db.insert(shootDetailTable).values({
        id: createId(),
        taskId: task.id,
        location: shootLocation || null,
        shootDate: shootDate ? new Date(shootDate).toISOString() : null,
        camera: shootCamera || null,
        quality: shootQuality || null,
        frameRate: shootFrameRate || null,
        lighting: shootLighting || null,
        exclusions: shootExclusions || null,
        referenceLinks: referenceLinksArray,
        videographerId: videographer || null,
        updatedAt: new Date().toISOString(),
      });
    }

    // 🔁 AUTO GENERATE TASKS (Only if it's a monthly deliverable)
    if (isExtraMonthlyTask && extraMonthlyDeliverable && extraSequence) {
      const companyName = client.companyName || client.name;
      const companyNameSlug = companyName.replace(/\s/g, '');
      const deliverableSlug = getDeliverableShortCode(extraMonthlyDeliverable.type);
      const taskCreatedAt = new Date(task.createdAt);
      const createdAtStr = formatDateMMDDYYYY(taskCreatedAt);
      const title = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${extraSequence}`;
      const taskFolderPath = await createTaskFolderStructure(companyName, title, currentMonth);
      const recurringMonthLabel = `${taskCreatedAt.getFullYear()}-${String(taskCreatedAt.getMonth() + 1).padStart(2, "0")}`;

      const [updatedExtra] = await db.update(taskTable).set({
        title,
        outputFolderId: taskFolderPath,
        recurringMonth: recurringMonthLabel,
        isExtra: true,
        extraSequence,
        updatedAt: new Date().toISOString(),
      }).where(eq(taskTable.id, task.id)).returning();

      const createdExtraTasks = [updatedExtra];

      for (let i = 1; i < extraQuantity; i++) {
        const nextSequence = extraSequence + i;
        const nextTitle = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${nextSequence}`;
        const nextTaskFolderPath = await createTaskFolderStructure(
          companyName,
          nextTitle,
          currentMonth
        );

        const [extraTask] = await db.insert(taskTable).values({
          id: createId(),
          title: nextTitle,
          description: description || "",
          dueDate: new Date(dueDate).toISOString(),
          assignedTo,
          qcSpecialist: qc_specialist,
          scheduler,
          videographer,
          createdBy: userId,
          clientId,
          clientUserId: client?.userId,
          monthlyDeliverableId,
          driveLinks: [],
          folderType: effectiveFolderType,
          monthFolder: currentMonth,
          outputFolderId: nextTaskFolderPath,
          recurringMonth: recurringMonthLabel,
          requiresClientReview: client.requiresClientReview,
          isTrial: client.isTrial ?? false,
          isExtra: true,
          extraSequence: nextSequence,
          deliverableType: resolvedDeliverableType,
          status: (client.requiresVideographer || shootLocation || shootCamera)
            ? "VIDEOGRAPHER_ASSIGNED"
            : "PENDING",
          updatedAt: new Date().toISOString(),
        }).returning();

        createdExtraTasks.push(extraTask);
      }

      // 🔔 Notify the assigned editor now that every extra task has its
      // real title (createdExtraTasks was built above with the final
      // title/folder already set) — one grouped Slack message covering
      // the whole batch instead of the old single premature "Untitled" one.
      if (assignedTo) {
        try {
          await notifyEditorTaskAssignment(assignedTo, createdExtraTasks.map((t: any) => t.id));
        } catch (err) {
          console.error("Failed to send assignment notification:", err);
        }
      }

      return NextResponse.json(
        {
          created: createdExtraTasks.length,
          tasks: createdExtraTasks,
          firstTask: updatedExtra,
        },
        { status: 201 }
      );
    } else if (monthlyDeliverableId) {
      await generateMonthlyTasksFromTemplate(task.id, monthlyDeliverableId);

      // 🔔 Notify now that generateMonthlyTasksFromTemplate has set the
      // real title on this template task (task.id) — see STEP 6 in
      // src/lib/recurring/generateMonthly.ts.
      if (assignedTo) {
        try {
          await notifyEditorTaskAssignment(assignedTo, [task.id]);
        } catch (err) {
          console.error("Failed to send assignment notification:", err);
        }
      }
    } else if (oneOffDeliverableId) {
      // 🔥 HANDLE ONE-OFF TASK NAMING AND FOLDERS
      const [deliverable] = await db.select().from(oneOffDeliverableTable)
        .where(eq(oneOffDeliverableTable.id, oneOffDeliverableId)).limit(1);

      if (deliverable) {
        // 🔥 Count existing tasks for this deliverable to get the next number
        const [{ value: existingCount }] = await db.select({ value: count() }).from(taskTable).where(and(
          eq(taskTable.clientId, clientId),
          eq(taskTable.oneOffDeliverableId, deliverable.id),
        ));

        const companyName = client.companyName || client.name;
        const companyNameSlug = companyName.replace(/\s/g, '');
        const deliverableSlug = getDeliverableShortCode(deliverable.type);
        const createdAtStr = formatDateMMDDYYYY(new Date(task.createdAt));
        // existingCount already includes the current task
        const title = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}${existingCount}`;

        // Create folder structure (grouped by month)
        const currentMonth = getCurrentMonthFolder();
        const taskFolderPath = await createTaskFolderStructure(companyName, title, currentMonth);

        // Update task with title and folder
        const [updatedOneOff] = await db.update(taskTable).set({
          title,
          outputFolderId: taskFolderPath,
          updatedAt: new Date().toISOString(),
        }).where(eq(taskTable.id, task.id)).returning();

        console.log(`✅ One-off task updated: ${title}`);

        // 🔔 Notify the assigned editor now that the task has its real
        // title (updatedOneOff, just set above) instead of the "" it had
        // when it was first inserted.
        if (assignedTo) {
          try {
            await notifyEditorTaskAssignment(assignedTo, [updatedOneOff.id]);
          } catch (err) {
            console.error("Failed to send assignment notification:", err);
          }
        }

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
      const [updatedMonthly] = await db.select().from(taskTable).where(eq(taskTable.id, task.id)).limit(1);
      return NextResponse.json(updatedMonthly || task, { status: 201 });
    }

    // 🔔 Plain task path (no monthly/one-off/extra deliverable link) — title
    // genuinely stays blank for these, so "Untitled" here is accurate, not
    // a timing bug like the other branches.
    if (assignedTo) {
      try {
        await notifyEditorTaskAssignment(assignedTo, [task.id]);
      } catch (err) {
        console.error("Failed to send assignment notification:", err);
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