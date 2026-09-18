// app/api/admin/tasks/route.ts
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import "@/lib/bigint-fix";
import { getDbHttp } from "@/lib/db";
import {
    task as taskTable,
    user as userTable,
    client as clientTable,
    monthlyDeliverable as monthlyDeliverableTable,
    oneOffDeliverable as oneOffDeliverableTable,
    tag as tagTable,
    tagToTask as tagToTaskTable,
} from "@/lib/db/schema";
import { and, or, eq, ne, gte, lte, lt, inArray, notInArray, isNotNull, ilike, desc, asc, count, exists, sql as drizzleSql } from "drizzle-orm";
import { getCurrentUser2 } from '@/lib/auth';

// 🔥 Role-switch support — mirrors src/app/api/tasks/route.ts and
// src/app/api/tasks/qc-completed/route.ts. A multi-role account (e.g. a
// scheduler who's also qc) needs this to resolve to their real access
// instead of only their primary `role`, which otherwise 403s here for
// anyone whose primary role isn't already admin/qc.
const LEGACY_ROLE_SWITCH_EMAILS = new Set([
    "eric@e8productions.com",
    "sahilsagvekar230@gmail.com",
]);
const DEFAULT_ADMIN_SWITCH_ROLES = ["qc", "sales", "sales_manager", "scheduler"];

function resolveEffectiveRole(
    role: string | null | undefined,
    roles: string[] | null | undefined,
    email: string | null | undefined,
    viewingAs: string | null
): string | null | undefined {
    const baseRole = role?.toLowerCase() || null;
    if (!viewingAs || viewingAs === baseRole) return role;

    const authorizedSwitchRoles = new Set<string>([
        ...(Array.isArray(roles) ? roles.map((r) => r.toLowerCase()) : []),
        ...(email && LEGACY_ROLE_SWITCH_EMAILS.has(email.toLowerCase())
            ? DEFAULT_ADMIN_SWITCH_ROLES
            : []),
        ...(baseRole === "admin" ? DEFAULT_ADMIN_SWITCH_ROLES : []),
    ]);

    if (!authorizedSwitchRoles.has(viewingAs)) return role;

    return viewingAs === "qc" ? "admin" : viewingAs;
}

// ─────────────────────────────────────────
// GET: Fetch all tasks with advanced filtering
// ─────────────────────────────────────────
// export async function GET(req: Request) {
//     try {
//         const token = getTokenFromCookies(req);
//         if (!token) {
//             return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
//         }

//         const auth = verifyAdminAccess(token);
//         if (!auth) {
//             return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 });
//         }

//         const { searchParams } = new URL(req.url);

//         // Pagination
//         const page = parseInt(searchParams.get("page") || "1");
//         const limit = parseInt(searchParams.get("limit") || "25");

//         // Sorting
//         const sortBy = searchParams.get("sortBy") || "createdAt";
//         const sortOrder = searchParams.get("sortOrder") || "desc";

//         // Filters
//         const editorId = searchParams.get("editor");
//         const qcId = searchParams.get("qc");
//         const schedulerId = searchParams.get("scheduler");
//         const videographerId = searchParams.get("videographer");
//         const clientId = searchParams.get("client");
//         const status = searchParams.get("status");
//         const priority = searchParams.get("priority");
//         const deliverableType = searchParams.get("deliverableType");
//         const search = searchParams.get("search");
//         const dueDateFrom = searchParams.get("dueDateFrom");
//         const dueDateTo = searchParams.get("dueDateTo");
//         const createdFrom = searchParams.get("createdFrom");
//         const createdTo = searchParams.get("createdTo");

//         // Build where clause with AND logic
//         const where: any = {};

//         if (editorId) where.assignedTo = parseInt(editorId);
//         if (qcId) where.qc_specialist = parseInt(qcId);
//         if (schedulerId) where.scheduler = parseInt(schedulerId);
//         if (videographerId) where.videographer = parseInt(videographerId);
//         if (clientId) where.clientId = clientId;
//         if (status) where.status = status as TaskStatus;
//         if (priority) where.priority = priority;

//         // Deliverable type filter
//         if (deliverableType) {
//             where.monthlyDeliverable = {
//                 type: deliverableType
//             };
//         }

//         // Text search on title and description
//         if (search) {
//             where.OR = [
//                 { title: { contains: search, mode: "insensitive" } },
//                 { description: { contains: search, mode: "insensitive" } },
//             ];
//         }

//         // Date range filters
//         if (dueDateFrom || dueDateTo) {
//             where.dueDate = {};
//             if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom);
//             if (dueDateTo) where.dueDate.lte = new Date(dueDateTo);
//         }

//         if (createdFrom || createdTo) {
//             where.createdAt = {};
//             if (createdFrom) where.createdAt.gte = new Date(createdFrom);
//             if (createdTo) where.createdAt.lte = new Date(createdTo);
//         }

//         // Build orderBy
//         const orderBy: any = {};
//         orderBy[sortBy] = sortOrder;

//         // Fetch tasks with related data + unique deliverable types
//         const [tasks, total, deliverableTypes] = await Promise.all([
//             prisma.task.findMany({
//                 where,
//                 take: limit,
//                 skip: (page - 1) * limit,
//                 orderBy,
//                 select: {
//                     id: true,
//                     title: true,
//                     description: true,
//                     taskType: true,
//                     status: true,
//                     dueDate: true,
//                     priority: true,
//                     createdAt: true,
//                     updatedAt: true,
//                     workflowStep: true,
//                     assignedTo: true,
//                     qc_specialist: true,
//                     scheduler: true,
//                     videographer: true,
//                     clientId: true,
//                     feedback: true,
//                     qcNotes: true,
//                     // Include related user data
//                     user: {
//                         select: {
//                             id: true,
//                             name: true,
//                             email: true,
//                             role: true,
//                         },
//                     },
//                     client: {
//                         select: {
//                             id: true,
//                             name: true,
//                             companyName: true,
//                         },
//                     },
//                     monthlyDeliverable: {
//                         select: {
//                             id: true,
//                             type: true,
//                         },
//                     },
//                 },
//             }),
//             prisma.task.count({ where }),
//             // Fetch all unique deliverable types for filter dropdown
//             prisma.monthlyDeliverable.findMany({
//                 select: { type: true },
//                 distinct: ['type'],
//                 orderBy: { type: 'asc' },
//             }),
//         ]);

//         // Fetch team member names for assigned users (QC, Scheduler, Videographer)
//         const userIds = new Set<number>();
//         tasks.forEach((task) => {
//             if (task.qc_specialist) userIds.add(task.qc_specialist);
//             if (task.scheduler) userIds.add(task.scheduler);
//             if (task.videographer) userIds.add(task.videographer);
//         });

//         const teamMembers = await prisma.user.findMany({
//             where: { id: { in: Array.from(userIds) } },
//             select: { id: true, name: true, role: true },
//         });

//         const memberMap = new Map(teamMembers.map((m) => [m.id, m]));

//         // Enrich tasks with team member names
//         const enrichedTasks = tasks.map((task) => ({
//             ...task,
//             editor: task.user,
//             qcSpecialist: task.qc_specialist ? memberMap.get(task.qc_specialist) : null,
//             schedulerUser: task.scheduler ? memberMap.get(task.scheduler) : null,
//             videographerUser: task.videographer ? memberMap.get(task.videographer) : null,
//         }));

//         // Calculate stats for quick summary
//         const statusCounts = await prisma.task.groupBy({
//             by: ["status"],
//             where,
//             _count: { status: true },
//         });

//         const overdueCount = await prisma.task.count({
//             where: {
//                 ...where,
//                 dueDate: { lt: new Date() },
//                 status: { notIn: ["COMPLETED", "SCHEDULED"] },
//             },
//         });

//         return NextResponse.json({
//             tasks: enrichedTasks,
//             pagination: {
//                 page,
//                 limit,
//                 total,
//                 totalPages: Math.ceil(total / limit),
//             },
//             // Include deliverable types for filter dropdown
//             deliverableTypes: deliverableTypes.map(d => d.type),
//             stats: {
//                 total,
//                 byStatus: statusCounts.reduce((acc, item) => {
//                     acc[item.status] = item._count.status;
//                     return acc;
//                 }, {} as Record<string, number>),
//                 overdue: overdueCount,
//             },
//         });
//     } catch (err: any) {
//         console.error("❌ GET /api/admin/tasks error:", err);
//         return NextResponse.json(
//             { message: "Server error", error: err.message },
//             { status: 500 }
//         );
//     }
// }


export async function GET(req: NextRequest) {
  const db = getDbHttp();
    try {
        const user = await getCurrentUser2(req);
        if (!user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const viewingAs = req.headers.get("x-viewing-as")?.toLowerCase() || null;
        const effectiveRole = resolveEffectiveRole(
            user.role,
            (user as any).roles,
            user.email,
            viewingAs
        )?.toLowerCase();

        if (!["admin", "qc", "videographer"].includes(effectiveRole || "")) {
            return NextResponse.json({ message: "Forbidden - Admin access required" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);

        // Pagination
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "25");

        // Sorting
        const sortBy = searchParams.get("sortBy") || "createdAt";
        const sortOrder = searchParams.get("sortOrder") || "desc";

        // Filters
        const editorId = searchParams.get("editor");
        const qcId = searchParams.get("qc");
        const schedulerId = searchParams.get("scheduler");
        const videographerId = searchParams.get("videographer");
        const clientId = searchParams.get("client");
        const status = searchParams.get("status");
        const priority = searchParams.get("priority");
        const deliverableType = searchParams.get("deliverableType");
        const search = searchParams.get("search");
        const dueDateFrom = searchParams.get("dueDateFrom");
        const dueDateTo = searchParams.get("dueDateTo");
        const createdFrom = searchParams.get("createdFrom");
        const createdTo = searchParams.get("createdTo");
        const month = searchParams.get("month");
        const tag = searchParams.get("tag");

        // Build where clause with AND logic
        const conditions: any[] = [];

        if (editorId) conditions.push(eq(taskTable.assignedTo, parseInt(editorId)));
        if (qcId) conditions.push(eq(taskTable.qcSpecialist, parseInt(qcId)));
        if (schedulerId) conditions.push(eq(taskTable.scheduler, parseInt(schedulerId)));
        if (videographerId) conditions.push(eq(taskTable.videographer, parseInt(videographerId)));
        if (clientId) conditions.push(eq(taskTable.clientId, clientId));
        if (status) conditions.push(eq(taskTable.status, status as any));
        if (priority) conditions.push(eq(taskTable.priority, priority));

        // Deliverable type filter
        if (deliverableType) {
            conditions.push(exists(
                db.select({ one: drizzleSql`1` }).from(monthlyDeliverableTable)
                    .where(and(eq(monthlyDeliverableTable.id, taskTable.monthlyDeliverableId), eq(monthlyDeliverableTable.type, deliverableType)))
            ));
        }

        // Month filter
        if (month && month !== 'all') {
            conditions.push(eq(taskTable.monthFolder, month));
        }

        // Tag filter
        if (tag && tag !== 'all') {
            conditions.push(exists(
                db.select({ one: drizzleSql`1` }).from(tagToTaskTable)
                    .innerJoin(tagTable, eq(tagToTaskTable.a, tagTable.id))
                    .where(and(eq(tagToTaskTable.b, taskTable.id), eq(tagTable.name, tag)))
            ));
        }

        // Text search on title and description
        if (search) {
            conditions.push(or(
                ilike(taskTable.title, `%${search}%`),
                ilike(taskTable.description, `%${search}%`),
            ));
        }

        // Date range filters
        if (dueDateFrom) conditions.push(gte(taskTable.dueDate, new Date(dueDateFrom).toISOString()));
        if (dueDateTo) conditions.push(lte(taskTable.dueDate, new Date(dueDateTo).toISOString()));

        if (createdFrom) conditions.push(gte(taskTable.createdAt, new Date(createdFrom).toISOString()));
        if (createdTo) conditions.push(lte(taskTable.createdAt, new Date(createdTo).toISOString()));

        const where = conditions.length ? and(...conditions) : undefined;

        // Check if using smart title sorting
        const useSmartTitleSort = sortBy === "title";

        // Build orderBy (skip if using smart sort - we'll sort in JS)
        const sortColumnMap: Record<string, any> = {
            id: taskTable.id,
            title: taskTable.title,
            description: taskTable.description,
            taskType: taskTable.taskType,
            status: taskTable.status,
            dueDate: taskTable.dueDate,
            priority: taskTable.priority,
            createdAt: taskTable.createdAt,
            updatedAt: taskTable.updatedAt,
            workflowStep: taskTable.workflowStep,
            assignedTo: taskTable.assignedTo,
            qc_specialist: taskTable.qcSpecialist,
            scheduler: taskTable.scheduler,
            videographer: taskTable.videographer,
            clientId: taskTable.clientId,
            deliverableType: taskTable.deliverableType,
            monthFolder: taskTable.monthFolder,
        };
        const orderColumn = sortColumnMap[sortBy] || taskTable.createdAt;
        const orderDir = sortOrder === "asc" ? asc : desc;
        const orderBy = useSmartTitleSort ? desc(taskTable.createdAt) : orderDir(orderColumn);

        // Helper function for smart title sorting
        const extractSortParts = (title: string | null) => {
            if (!title) return { company: '', date: '', prefix: '', number: 0 };

            // Match: CompanyName_DD-MM-YYYY_TypeNumber
            // Example: CoinLaundryAssociation_01-12-2026_LF1
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

        // Type priority: LF → SF → SQF → others alphabetically
        const getTypePriority = (prefix: string): number => {
            const priorities: Record<string, number> = { lf: 1, sf: 2, sqf: 3 };
            return priorities[prefix] || 99;
        };

        // Smart sort function
        const smartTitleSort = <T extends { title: string | null }>(tasks: T[], order: string): T[] => {
            const sorted = [...tasks].sort((a, b) => {
                const taskA = extractSortParts(a.title);
                const taskB = extractSortParts(b.title);

                // 1. Sort by company name
                if (taskA.company !== taskB.company) {
                    return taskA.company.localeCompare(taskB.company);
                }

                // 2. Sort by date (convert DD-MM-YYYY to YYYYMMDD for comparison)
                if (taskA.date !== taskB.date) {
                    const dateA = taskA.date.split('-').reverse().join('');
                    const dateB = taskB.date.split('-').reverse().join('');
                    return dateA.localeCompare(dateB);
                }

                // 3. Sort by type priority (LF before SF before SQF)
                const priorityA = getTypePriority(taskA.prefix);
                const priorityB = getTypePriority(taskB.prefix);
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }

                // 4. Sort by number
                return taskA.number - taskB.number;
            });

            return order === "desc" ? sorted.reverse() : sorted;
        };

        // Smart title sort: fetch only the current page window after a DB-side count.
        // Previously fetched 1000 rows and sorted in JS — replaced with a reasonable
        // cap (500) that still covers all practical cases while avoiding OOM on EC2.
        // The sort itself still runs in JS because Postgres can't parse the title format.
        const SMART_SORT_CAP = 500;

        // Fetch tasks with related data + unique deliverable types + available months
        const [rawTasks, [{ value: total }], deliverableTypesRaw, distinctMonths] = await Promise.all([
            db.query.task.findMany({
                where,
                limit: useSmartTitleSort ? SMART_SORT_CAP : limit,
                offset: useSmartTitleSort ? 0 : (page - 1) * limit,
                orderBy,
                columns: {
                    id: true,
                    title: true,
                    description: true,
                    taskType: true,
                    status: true,
                    dueDate: true,
                    priority: true,
                    createdAt: true,
                    updatedAt: true,
                    workflowStep: true,
                    assignedTo: true,
                    thumbnailEditor: true,
                    qcSpecialist: true,
                    scheduler: true,
                    videographer: true,
                    clientId: true,
                    feedback: true,
                    qcNotes: true,
                    deliverableType: true,
                    monthFolder: true,
                    isExtra: true,
                    extraSequence: true,
                },
                with: {
                    user_assignedTo: { columns: { id: true, name: true, email: true, role: true } },
                    client: { columns: { id: true, name: true, companyName: true } },
                    monthlyDeliverable: { columns: { id: true, type: true } },
                    oneOffDeliverable: { columns: { id: true, type: true } },
                    tagToTasks: { with: { tag: { columns: { id: true, name: true } } } },
                },
            }),
            db.select({ value: count() }).from(taskTable).where(where),
            db.selectDistinct({ type: monthlyDeliverableTable.type }).from(monthlyDeliverableTable).orderBy(asc(monthlyDeliverableTable.type)),
            // Distinct monthFolder values — calendar-sorted below (string ORDER BY is alphabetical)
            db.selectDistinct({ monthFolder: taskTable.monthFolder }).from(taskTable)
                .where(isNotNull(taskTable.monthFolder)),
        ]);
        const deliverableTypes = deliverableTypesRaw;

        const MONTH_INDEX: Record<string, number> = {
            january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
            july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
        };
        const monthFolderSortKey = (folder: string): number => {
            const match = folder.match(/^([A-Za-z]+)-(\d{4})$/);
            if (!match) return 0;
            const month = MONTH_INDEX[match[1].toLowerCase()];
            const year = parseInt(match[2], 10);
            if (month === undefined || !Number.isFinite(year)) return 0;
            return year * 12 + month;
        };

        // Rename Drizzle relation keys back to the Prisma field names this
        // handler was written against.
        const tasks = rawTasks.map((t: any) => {
            const { qcSpecialist, user_assignedTo, tagToTasks, ...rest } = t;
            return {
                ...rest,
                qc_specialist: qcSpecialist,
                user: user_assignedTo,
                tags: (tagToTasks ?? []).map((tt: any) => tt.tag),
            };
        });

        // Apply smart sorting and pagination if needed
        let sortedTasks = tasks;
        if (useSmartTitleSort) {
            sortedTasks = smartTitleSort(tasks, sortOrder);
            // Manual pagination after sorting
            sortedTasks = sortedTasks.slice((page - 1) * limit, page * limit);
        }

        // Fetch team member names for assigned users
        const userIds = new Set<number>();
        sortedTasks.forEach((task) => {
            if (task.qc_specialist) userIds.add(task.qc_specialist);
            if (task.scheduler) userIds.add(task.scheduler);
            if (task.videographer) userIds.add(task.videographer);
            if (task.thumbnailEditor) userIds.add(task.thumbnailEditor);
        });

        const teamMembers = userIds.size > 0
            ? await db.select({ id: userTable.id, name: userTable.name, role: userTable.role })
                .from(userTable)
                .where(inArray(userTable.id, Array.from(userIds)))
            : [];

        const memberMap = new Map(teamMembers.map((m) => [m.id, m]));

        // Enrich tasks with team member names
        const enrichedTasks = sortedTasks.map((task) => ({
            ...task,
            editor: task.user,
            qcSpecialist: task.qc_specialist ? memberMap.get(task.qc_specialist) : null,
            schedulerUser: task.scheduler ? memberMap.get(task.scheduler) : null,
            videographerUser: task.videographer ? memberMap.get(task.videographer) : null,
            thumbnailEditorUser: task.thumbnailEditor ? memberMap.get(task.thumbnailEditor) : null,
        }));

        // Calculate stats for quick summary
        const statusCounts = await db.select({ status: taskTable.status, cnt: count() })
            .from(taskTable)
            .where(where)
            .groupBy(taskTable.status);

        const [{ value: overdueCount }] = await db.select({ value: count() })
            .from(taskTable)
            .where(and(
                where,
                lt(taskTable.dueDate, new Date().toISOString()),
                notInArray(taskTable.status, ["COMPLETED", "SCHEDULED"] as any),
            ));

        return NextResponse.json({
            tasks: enrichedTasks,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            deliverableTypes: deliverableTypes.map(d => d.type),
            availableMonths: (distinctMonths.map(d => d.monthFolder).filter(Boolean) as string[])
                .sort((a, b) => monthFolderSortKey(b) - monthFolderSortKey(a)), // newest first
            stats: {
                total,
                byStatus: statusCounts.reduce((acc, item) => {
                    if (item.status) {
                        acc[item.status] = item.cnt;
                    }
                    return acc;
                }, {} as Record<string, number>),
                overdue: overdueCount,
            },
        });
    } catch (err: any) {
        console.error("❌ GET /api/admin/tasks error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }
}