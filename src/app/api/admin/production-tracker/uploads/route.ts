import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  try {
    const user = await getCurrentUser2(req);
    if (!user || !["admin", "manager"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");
    const employeeIdParam = searchParams.get("employeeId");
    const clientId = searchParams.get("clientId") || undefined;
    const employeeId = employeeIdParam ? parseInt(employeeIdParam) : undefined;

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

      const files = await prisma.file.findMany({
        where: {
          uploadedAt: { gte: monthStart, lte: monthEnd },
          isActive: true,
          ...(employeeId ? { uploadedBy: employeeId } : {}),
          ...(clientId
            ? { task: { clientId } }
            : {}),
        },
        select: { uploadedAt: true },
      });

      const counts: Record<string, number> = {};
      // Pre-fill every day of the month with 0 so the frontend doesn't have
      // to guess which days exist.
      for (let d = 1; d <= monthEnd.getDate(); d++) {
        const key = new Date(year, monthIndex, d).toISOString().slice(0, 10);
        counts[key] = 0;
      }
      for (const f of files) {
        const key = f.uploadedAt.toISOString().slice(0, 10);
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

    const files = await prisma.file.findMany({
      where: {
        uploadedAt: { gte: rangeStart, lte: rangeEnd },
        isActive: true,
        ...(employeeId ? { uploadedBy: employeeId } : {}),
        ...(clientId ? { task: { clientId } } : {}),
      },
      select: {
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
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            clientId: true,
            client: { select: { id: true, name: true, companyName: true } },
          },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });

    const uploaderIds = [...new Set(files.map((f) => f.uploadedBy).filter(Boolean))] as number[];
    const uploaders = await prisma.user.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, name: true, email: true },
    });
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