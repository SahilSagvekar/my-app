export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { addSignedUrlsToFiles } from "@/lib/s3";

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
    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status");
    const clientId = url.searchParams.get("clientId");
    const deliverableType = url.searchParams.get("deliverableType");
    const dateRange = url.searchParams.get("dateRange");
    const includeTitling = url.searchParams.get("includeTitling") === "true";

    // Build filter
    const where: any = {};

    if (clientId && clientId !== "all") {
      where.clientId = clientId;
    }

    // Status filter logic
    // Valid TaskStatus values: PENDING, IN_PROGRESS, READY_FOR_QC, QC_IN_PROGRESS, COMPLETED, SCHEDULED, ON_HOLD, REJECTED, CLIENT_REVIEW, VIDEOGRAPHER_ASSIGNED, POSTED
    if (status && status !== "all") {
      const upperStatus = status.toUpperCase();
      if (upperStatus === "PENDING") {
        // Pending = COMPLETED (QC approved, waiting to be scheduled)
        where.status = "COMPLETED";
      } else if (upperStatus === "SCHEDULED") {
        // Scheduled includes SCHEDULED and POSTED
        where.status = { in: ["SCHEDULED", "POSTED"] };
      } else {
        where.status = upperStatus;
      }
    } else {
      // Default: show COMPLETED + SCHEDULED + POSTED (scheduler-relevant tasks)
      where.status = { in: ["COMPLETED", "SCHEDULED", "POSTED"] };
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { client: { name: { contains: search, mode: "insensitive" } } },
            { client: { companyName: { contains: search, mode: "insensitive" } } },
          ]
        }
      ];
    }

    if (deliverableType && deliverableType !== "all") {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { monthlyDeliverable: { type: deliverableType } },
            { oneOffDeliverable: { type: deliverableType } },
          ]
        }
      ];
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let startDate = new Date();
      if (dateRange === "7d") startDate.setDate(now.getDate() - 7);
      else if (dateRange === "30d") startDate.setDate(now.getDate() - 30);
      else if (dateRange === "90d") startDate.setDate(now.getDate() - 90);
      
      where.createdAt = { gte: startDate };
    }

    // If role is scheduler, only show tasks assigned to them
    if (role === "scheduler") {
      where.scheduler = userId;
    }

    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Fetch tasks that are ready for scheduler (QC approved or in scheduler status)
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
          user: true,
          files: {
            where: { isActive: true },
            select: {
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
      }),
      prisma.task.count({ where })
    ]);

    const uniqueClients = Array.from(new Set(tasks.map(t => t.client?.id).filter(Boolean))).map(id => {
      const client = tasks.find(t => t.client?.id === id)?.client;
      return { id, name: client?.name, companyName: client?.companyName };
    });

    const uniqueDeliverables = Array.from(new Set(tasks.map(t => {
      const d = t.monthlyDeliverable || t.oneOffDeliverable;
      return d?.type;
    }).filter(Boolean)));

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
          description: t.description,
          status: t.status,
          isTrial: t.isTrial,
          editor: t.user ? { name: t.user.name } : null,
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
          priority: t.priority,
          client: t.client,
          files: filesWithUrls,
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
    return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
  }
}