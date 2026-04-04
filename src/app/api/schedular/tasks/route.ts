export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/authToken=([^;]+)/);
  return m ? m[1] : null;
}

export async function GET(req: Request) {
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
    const includeTitling = url.searchParams.get("includeTitling") === "true";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "all";
    const clientId = url.searchParams.get("clientId") || "all";
    const deliverableType = url.searchParams.get("deliverableType") || "all";
    const dateRange = url.searchParams.get("dateRange") || "30d";

    const skip = (page - 1) * limit;

    // Filter by date
    let fromDate: Date | null = null;
    if (dateRange !== "all") {
      fromDate = new Date();
      const days = parseInt(dateRange);
      if (!isNaN(days)) {
        fromDate.setDate(fromDate.getDate() - days);
      } else if (dateRange === "7d") {
        fromDate.setDate(fromDate.getDate() - 7);
      } else if (dateRange === "30d") {
        fromDate.setDate(fromDate.getDate() - 30);
      } else if (dateRange === "90d") {
        fromDate.setDate(fromDate.getDate() - 90);
      }
    }

    // Build filter
    const where: any = {
      AND: [
        {
          OR: [
            { status: "COMPLETED" },
            { status: "SCHEDULED" },
          ],
        }
      ]
    };

    // Search filter (on title or client name)
    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { client: { name: { contains: search, mode: 'insensitive' } } },
          { client: { companyName: { contains: search, mode: 'insensitive' } } },
        ]
      });
    }

    // Status filter
    if (status !== "all") {
      if (status === "pending") {
        where.AND.push({ status: "COMPLETED" });
      } else if (status === "scheduled") {
        where.AND.push({ status: "SCHEDULED" });
      }
    }

    // Client filter
    if (clientId !== "all") {
      where.AND.push({ clientId });
    }

    // Deliverable Type filter
    if (deliverableType !== "all") {
      where.AND.push({
        OR: [
          { monthlyDeliverable: { type: { contains: deliverableType, mode: 'insensitive' } } },
          { oneOffDeliverable: { type: { contains: deliverableType, mode: 'insensitive' } } },
        ]
      });
    }

    // Date filter
    if (fromDate) {
      where.AND.push({ createdAt: { gte: fromDate } });
    }

    // NOTE: All schedulers can see all tasks - multiple schedulers can be
    // assigned to the same client's deliverables. They use client/deliverable
    // filters to focus on their specific assignments.

    // Get total count for pagination
    const total = await prisma.task.count({ where });

    // Fetch tasks that are ready for scheduler (QC approved or in scheduler status)
    // Only select fields needed for the spreadsheet view
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        clientId: true,
        driveLinks: true,
        createdAt: true,
        updatedAt: true,
        titlingStatus: true,
        titlingError: true,
        suggestedTitles: true,
        platform: true,
        socialMediaLinks: true,
        priority: true,
        monthlyDeliverableId: true,
        oneOffDeliverableId: true,
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        files: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            mimeType: true,
            size: true,
            s3Key: true,
            folderType: true,
          },
        },
        monthlyDeliverable: {
          select: {
            id: true,
            type: true,
            quantity: true,
            videosPerDay: true,
            postingSchedule: true,
            postingDays: true,
            postingTimes: true,
            platforms: true,
            description: true,
          },
        },
        oneOffDeliverable: {
          select: {
            id: true,
            type: true,
            quantity: true,
            platforms: true,
            description: true,
          },
        },
        ...(includeTitling && {
          titlingJob: {
            select: {
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

    // Map payload — no URL signing here, done on-demand via /api/files/[id]/sign
    const payload = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      dueDate: t.dueDate,
      clientId: t.clientId,
      driveLinks: t.driveLinks || [],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      titlingStatus: t.titlingStatus,
      titlingError: t.titlingError,
      suggestedTitles: t.suggestedTitles,
      platform: t.platform,
      socialMediaLinks: t.socialMediaLinks || [],
      priority: t.priority,
      client: t.client,
      files: t.files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: Number(f.size),
        s3Key: f.s3Key,
        folderType: f.folderType,
      })),
      titlingJob: (t as any).titlingJob || null,
      monthlyDeliverable: t.monthlyDeliverable || null,
      oneOffDeliverable: t.oneOffDeliverable || null,
    }));

    // Return in the format expected by Scheduler Spread Sheet View with pagination info
    return NextResponse.json({ 
      tasks: payload,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    }, { status: 200 });

  } catch (err: any) {
    console.error("GET /api/schedular/tasks error:", err);
    return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
  }
}