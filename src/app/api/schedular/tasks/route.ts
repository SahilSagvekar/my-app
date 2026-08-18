export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getDbHttp } from "@/lib/db";
import { task, client, monthlyDeliverable, oneOffDeliverable, tagToTask, tag as tagTable } from "@/lib/db/schema";
import { and, or, eq, ne, ilike, inArray, gte, desc, count as countFn } from "drizzle-orm";
import { addSignedUrlsToFiles } from "@/lib/s3";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/authToken=([^;]+)/);
  return m ? m[1] : null;
}

export async function GET(req: Request) {
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    // Only scheduler / manager / admin should access
    if (!["scheduler", "manager", "admin"].includes((role || "").toLowerCase())) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status");
    const clientId = url.searchParams.get("clientId");
    const deliverableType = url.searchParams.get("deliverableType");
    const editorId = url.searchParams.get("editorId");
    const tag = url.searchParams.get("tag");
    const dateRange = url.searchParams.get("dateRange");
    const includeTitling = url.searchParams.get("includeTitling") === "true";

    // Build filter
    const conditions: any[] = [];

    if (clientId && clientId !== "all") {
      conditions.push(eq(task.clientId, clientId));
    }

    // Status filter logic
    // Valid TaskStatus values: PENDING, IN_PROGRESS, READY_FOR_QC, QC_IN_PROGRESS, COMPLETED, SCHEDULED, ON_HOLD, REJECTED, CLIENT_REVIEW, VIDEOGRAPHER_ASSIGNED, POSTED
    if (status && status !== "all") {
      const upperStatus = status.toUpperCase();
      if (upperStatus === "PENDING") {
        // Pending = COMPLETED (QC approved, waiting to be scheduled)
        conditions.push(eq(task.status, "COMPLETED"));
      } else if (upperStatus === "SCHEDULED") {
        // Scheduled includes SCHEDULED and POSTED
        conditions.push(inArray(task.status, ["SCHEDULED", "POSTED"] as any));
      } else {
        conditions.push(eq(task.status, upperStatus as any));
      }
    } else {
      // Default: show COMPLETED + SCHEDULED + POSTED (scheduler-relevant tasks)
      conditions.push(inArray(task.status, ["COMPLETED", "SCHEDULED", "POSTED"] as any));
    }

    // NOTE: these filters resolve matching IDs via standalone lookup queries
    // rather than `exists(db.select()...)` correlated subqueries. Drizzle's
    // relational query builder (db.query.task.findMany) aliases the main
    // table as "task" in the generated SQL, but a correlated subquery built
    // with a fresh db.select() has no awareness of that alias and compiles
    // the outer reference against the table's real SQL name ("Task")
    // instead — Postgres then rejects it with "invalid reference to
    // FROM-clause entry for table \"Task\"". inArray(..., []) safely
    // compiles to `false`, so an empty match list just excludes everything.
    if (search) {
      const pattern = `%${search}%`;
      const matchingClients = await db.select({ id: client.id }).from(client)
        .where(or(ilike(client.name, pattern), ilike(client.companyName, pattern)));
      conditions.push(or(
        ilike(task.title, pattern),
        inArray(task.clientId, matchingClients.map(c => c.id)),
      ));
    }

    if (deliverableType && deliverableType !== "all") {
      const [matchingMonthly, matchingOneOff] = await Promise.all([
        db.select({ id: monthlyDeliverable.id }).from(monthlyDeliverable).where(eq(monthlyDeliverable.type, deliverableType)),
        db.select({ id: oneOffDeliverable.id }).from(oneOffDeliverable).where(eq(oneOffDeliverable.type, deliverableType)),
      ]);
      conditions.push(or(
        inArray(task.monthlyDeliverableId, matchingMonthly.map(d => d.id)),
        inArray(task.oneOffDeliverableId, matchingOneOff.map(d => d.id)),
      ));
    }

    if (editorId && editorId !== "all") {
      conditions.push(eq(task.assignedTo, Number(editorId)));
    }

    if (tag && tag !== "all") {
      const taggedTaskIds = await db.select({ taskId: tagToTask.b })
        .from(tagToTask)
        .innerJoin(tagTable, eq(tagToTask.a, tagTable.id))
        .where(eq(tagTable.name, tag));
      conditions.push(inArray(task.id, taggedTaskIds.map(t => t.taskId)));
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let startDate = new Date();
      if (dateRange === "7d") startDate.setDate(now.getDate() - 7);
      else if (dateRange === "30d") startDate.setDate(now.getDate() - 30);
      else if (dateRange === "90d") startDate.setDate(now.getDate() - 90);

      conditions.push(gte(task.createdAt, startDate.toISOString()));
    }

    // If role is scheduler, only show tasks assigned to them
    if (role === "scheduler") {
      conditions.push(eq(task.scheduler, userId));
    }

    const where = and(...conditions);

    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Fetch tasks that are ready for scheduler (QC approved or in scheduler status)
    // NOTE: these run sequentially rather than via Promise.all — running
    // concurrent queries against one Neon serverless Pool connection was
    // causing intermittent "Network connection lost" errors.
    const rawTasks = await db.query.task.findMany({
      where,
      orderBy: desc(task.createdAt),
      offset: skip,
      limit,
      with: {
        client: {
          columns: {
            id: true,
            name: true,
            companyName: true,
            requiresCoverImage: true,
          },
        },
        user_assignedTo: true,
        files: {
          where: (f, { eq }) => eq(f.isActive, true),
          columns: {
            id: true,
            name: true,
            url: true,
            mimeType: true,
            size: true,
            s3Key: true,
            folderType: true,
          },
        },
        monthlyDeliverable: true,
        oneOffDeliverable: true,
        tagToTasks: { with: { tag: true } },
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
              columns: { version: true, name: true },
            },
            user: {
              columns: { id: true, name: true, role: true },
            },
          },
          orderBy: (tf, { desc }) => desc(tf.createdAt),
        },
        ...(includeTitling && {
          titlingJobs: {
            columns: {
              id: true,
              status: true,
              videoDuration: true,
              completedAt: true,
              error: true,
              attempts: true,
            },
          },
        }),
      },
    });

    const [{ value: total }] = await db.select({ value: countFn() }).from(task).where(where);

    // Rename relation keys back to the Prisma-era shape the rest of this
    // handler (and frontend) expects.
    const tasks = rawTasks.map((t: any) => {
      const { user_assignedTo, tagToTasks, taskFeedbacks, titlingJobs, ...rest } = t;
      return {
        ...rest,
        user: user_assignedTo,
        tags: (tagToTasks ?? []).map((tt: any) => tt.tag),
        taskFeedback: taskFeedbacks,
        titlingJob: titlingJobs?.[0] ?? null,
      };
    });

    const uniqueClients = Array.from(new Set(tasks.map(t => t.client?.id).filter(Boolean))).map(id => {
      const c = tasks.find(t => t.client?.id === id)?.client;
      return { id, name: c?.name, companyName: c?.companyName };
    });

    const uniqueDeliverables = Array.from(new Set(tasks.map(t => {
      const d = t.monthlyDeliverable || t.oneOffDeliverable;
      return d?.type;
    }).filter(Boolean)));

    // isSponsored is a normal accessible column via Drizzle (the raw-query
    // workaround here was only needed for a stale generated Prisma client)
    const sponsoredMap = new Map(tasks.map((t: any) => [t.id, t.isSponsored ?? false]));

    // Map and add signed URLs
    const payload = await Promise.all(
      tasks.map(async (t) => {
        // Convert BigInt size to number
        const mappedFiles = t.files.map((f) => ({
          ...f,
          size: Number(f.size),
        }));

        const filesWithUrls = await addSignedUrlsToFiles(mappedFiles);
        const rawDeliverable = t.monthlyDeliverable || t.oneOffDeliverable;

        return {
          id: t.id,
          title: t.title,
          postingTitle: (t as any).postingTitle || null,
          titleSetByQC: (t as any).titleSetByQc ?? false,
          titleSetByClient: (t as any).titleSetByClient ?? false,
          postingTitles: (t as any).postingTitles || [],
          postingDescriptions: (t as any).postingDescriptions || [],
          postingTags: (t as any).postingTags || [],
          description: t.description,
          status: t.status,
          editor: t.user ? { id: t.user.id, name: t.user.name } : null,
          dueDate: t.dueDate,
          clientId: t.clientId,
          driveLinks: t.driveLinks || [],
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          titlingStatus: t.titlingStatus,
          titlingError: t.titlingError,
          transcript: t.transcript,
          transcriptSummary: t.transcriptSummary,
          suggestedTitles: t.suggestedTitles,
          platform: t.platform,
          socialMediaLinks: t.socialMediaLinks || [],
          postingDate: (() => {
            const links = Array.isArray(t.socialMediaLinks) ? t.socialMediaLinks as any[] : [];
            if (!links.length) return null;
            const dates = links.map((l: any) => new Date(l.postedAt).getTime()).filter(d => !isNaN(d));
            if (!dates.length) return null;
            return new Date(Math.min(...dates)).toISOString();
          })(),
          isSponsored: sponsoredMap.get(t.id) ?? false,
          deliverableType: t.deliverableType ?? null,
          tags: (t as any).tags || [],
          priority: t.priority,
          client: t.client,
          files: filesWithUrls,
          taskFeedback: ((t as any).taskFeedback || []).map((fb: any) => ({
            id: fb.id,
            fileId: fb.fileId,
            folderType: fb.folderType,
            feedback: fb.feedback,
            status: fb.status,
            timestamp: fb.timestamp,
            category: fb.category,
            createdAt: fb.createdAt,
            resolvedAt: fb.resolvedAt,
            acknowledgedAt: fb.acknowledgedAt,
            acknowledgedBy: fb.acknowledgedBy,
            fileVersion: fb.file?.version || 1,
            fileName: fb.file?.name || null,
            authorId: fb.user?.id,
            authorName: fb.user?.name || 'Unknown',
            authorRole: fb.user?.role || null,
          })),
          titlingJob: (t as any).titlingJob || null,
          deliverable: rawDeliverable ? {
            id: rawDeliverable.id,
            type: rawDeliverable.type,
            quantity: (rawDeliverable as any).quantity,
            videosPerDay: (rawDeliverable as any).videosPerDay,
            postingSchedule: (rawDeliverable as any).postingSchedule,
            postingDays: (rawDeliverable as any).postingDays || [],
            postingTimes: (rawDeliverable as any).postingTimes || [],
            platforms: (rawDeliverable as any).platforms || [],
            description: rawDeliverable.description,
            isTrial: (rawDeliverable as any).isTrial ?? false,
            isOneOff: !!t.oneOffDeliverable,
          } : null,
        };
      })
    );

    // Return in the format expected by SchedulerApprovedQueuePage
    return NextResponse.json({ 
      tasks: payload, 
      uniqueClients, 
      uniqueDeliverables,
      total,
      hasMore: skip + payload.length < total
    }, { status: 200 });

  } catch (err: any) {
    console.error("GET /api/schedular/tasks error:", err);
    if (err?.cause) {
      console.error("GET /api/schedular/tasks root cause:", err.cause);
    }
    return NextResponse.json({ message: "Server error", error: err.message, cause: err?.cause?.message }, { status: 500 });
  }
}