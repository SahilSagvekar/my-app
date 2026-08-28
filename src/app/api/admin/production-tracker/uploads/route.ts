import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import {
  user as userTable,
  file as fileTable,
  task as taskTable,
  client as clientTable,
} from "@/lib/db/schema";
import { and, eq, gte, lte, inArray, exists, sql as drizzleSql } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

// GET /api/admin/production-tracker/uploads
//
// Two modes:
//   ?mode=counts&month=July-2026&employeeId=optional
//     -> returns { "2026-07-01": 3, "2026-07-02": 0, ... } for every day in
//        that month, so the calendar can show a badge/heat-dot per day.
//
//   ?from=2026-07-01&to=2026-07-05&employeeId=optional&clientId=optional
//   (or just ?date=2026-07-03 for a single day)
//     -> returns the actual list of files uploaded in that range: who
//        uploaded it, for which client/task, and when.
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || !["admin", "manager", "scheduler"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");
    const employeeIdParam = searchParams.get("employeeId");
    const clientId = searchParams.get("clientId") || undefined;
    const employeeId = employeeIdParam ? parseInt(employeeIdParam) : undefined;

    // If a specific employee is requested (rather than "all"), make sure
    // they're actually active — don't let a stale bookmarked URL or direct
    // API call surface a terminated/inactive employee's data.
    if (employeeId !== undefined) {
      const [employee] = await db.select({ employeeStatus: userTable.employeeStatus })
        .from(userTable).where(eq(userTable.id, employeeId)).limit(1);
      if (!employee || employee.employeeStatus !== "ACTIVE") {
        return NextResponse.json(
          mode === "counts" ? { month: "", counts: {} } : { from: "", to: "", total: 0, uploads: [], byEmployee: {} }
        );
      }
    }

    // When "all employees" is selected (no specific employeeId filter),
    // scope results to currently-active employees only — a production
    // tracker should reflect the current team, not former staff.
    let activeUploaderIds: number[] | undefined;
    if (employeeId === undefined) {
      const activeUsers = await db.select({ id: userTable.id })
        .from(userTable).where(eq(userTable.employeeStatus, "ACTIVE"));
      activeUploaderIds = activeUsers.map((u: { id: number }) => u.id);
    }

    // ─── Mode: per-day counts for a whole month (drives the calendar dots) ───
    if (mode === "counts") {
      const monthParam = searchParams.get("month");
      const now = new Date();
      const targetMonth =
        monthParam ||
        `${now.toLocaleString("en-US", { month: "long" })}-${now.getFullYear()}`;

      const [monthName, yearStr] = targetMonth.split("-");
      const monthIndex = new Date(`${monthName} 1, ${yearStr}`).getMonth();
      const year = parseInt(yearStr);
      const monthStart = new Date(year, monthIndex, 1);
      const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      const files = await db.select({ uploadedAt: fileTable.uploadedAt })
        .from(fileTable)
        .where(and(
          gte(fileTable.uploadedAt, monthStart.toISOString()),
          lte(fileTable.uploadedAt, monthEnd.toISOString()),
          eq(fileTable.isActive, true),
          employeeId
            ? eq(fileTable.uploadedBy, employeeId)
            : (activeUploaderIds ? inArray(fileTable.uploadedBy, activeUploaderIds) : undefined),
          clientId
            ? exists(db.select({ one: drizzleSql`1` }).from(taskTable).where(and(eq(taskTable.id, fileTable.taskId), eq(taskTable.clientId, clientId))))
            : undefined,
        ));

      const counts: Record<string, number> = {};
      // Pre-fill every day of the month with 0 so the frontend doesn't have
      // to guess which days exist.
      for (let d = 1; d <= monthEnd.getDate(); d++) {
        const key = new Date(year, monthIndex, d).toISOString().slice(0, 10);
        counts[key] = 0;
      }
      for (const f of files) {
        const key = new Date(f.uploadedAt).toISOString().slice(0, 10);
        counts[key] = (counts[key] || 0) + 1;
      }

      return NextResponse.json({ month: targetMonth, counts });
    }

    // ─── Mode: detail list for a specific date / date range ───
    const dateParam = searchParams.get("date");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    if (!dateParam && !fromParam) {
      return NextResponse.json(
        { error: "Provide either ?date=YYYY-MM-DD or ?from=&to=" },
        { status: 400 }
      );
    }

    const rangeStart = new Date(`${dateParam || fromParam}T00:00:00`);
    const rangeEnd = new Date(`${toParam || dateParam || fromParam}T23:59:59.999`);

    const files = await db.query.file.findMany({
      where: and(
        gte(fileTable.uploadedAt, rangeStart.toISOString()),
        lte(fileTable.uploadedAt, rangeEnd.toISOString()),
        eq(fileTable.isActive, true),
        employeeId
          ? eq(fileTable.uploadedBy, employeeId)
          : (activeUploaderIds ? inArray(fileTable.uploadedBy, activeUploaderIds) : undefined),
        clientId
          ? exists(db.select({ one: drizzleSql`1` }).from(taskTable).where(and(eq(taskTable.id, fileTable.taskId), eq(taskTable.clientId, clientId))))
          : undefined,
      ),
      columns: {
        id: true,
        name: true,
        uploadedAt: true,
        uploadedBy: true,
        s3Key: true,
        mimeType: true,
        size: true,
        folderType: true,
        version: true,
        isActive: true,
      },
      with: {
        task: {
          columns: { id: true, title: true, status: true, clientId: true },
          with: {
            client: { columns: { id: true, name: true, companyName: true } },
          },
        },
      },
      orderBy: (f, { desc }) => desc(f.uploadedAt),
    });

    const uploaderIds = [...new Set(files.map((f) => f.uploadedBy).filter(Boolean))] as number[];
    const uploaders = uploaderIds.length > 0
      ? await db.select({ id: userTable.id, name: userTable.name, email: userTable.email })
          .from(userTable)
          .where(inArray(userTable.id, uploaderIds))
      : [];
    const uploaderMap = new Map(uploaders.map((u) => [u.id, u.name || u.email]));

    const results = files.map((f) => ({
      fileId: f.id,
      fileName: f.name,
      uploadedAt: f.uploadedAt,
      mimeType: f.mimeType,
      size: f.size != null ? Number(f.size) : 0,
      folderType: f.folderType,
      version: f.version,
      isActive: f.isActive,
      employeeId: f.uploadedBy,
      employeeName: f.uploadedBy ? uploaderMap.get(f.uploadedBy) || "Unknown" : "Unknown",
      taskId: f.task?.id,
      taskTitle: f.task?.title,
      taskStatus: f.task?.status,
      clientId: f.task?.clientId,
      clientName: f.task?.client?.companyName || f.task?.client?.name,
    }));

    // Grouped by employee, for the "quick glance" view
    const byEmployee: Record<string, typeof results> = {};
    for (const r of results) {
      const key = r.employeeName;
      if (!byEmployee[key]) byEmployee[key] = [];
      byEmployee[key].push(r);
    }

    return NextResponse.json({
      from: rangeStart.toISOString().slice(0, 10),
      to: rangeEnd.toISOString().slice(0, 10),
      total: results.length,
      uploads: results,
      byEmployee,
    });
  } catch (err: any) {
    console.error("Upload calendar error:", err);
    return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
  }
}