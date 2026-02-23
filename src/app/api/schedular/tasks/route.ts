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
    const includeTitling = url.searchParams.get("includeTitling") === "true";

    // Build filter
    const where: any = {
      OR: [
        { status: "COMPLETED" },
        // { status: "CLIENT_REVIEW" },
        { status: "SCHEDULED" },
      ],
    };

    // If role is scheduler, only show tasks assigned to them
    if (role === "scheduler") {
      where.scheduler = userId;
    }

    // Fetch tasks that are ready for scheduler (QC approved or in scheduler status)
    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
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
            url: true,
            mimeType: true,
            size: true,
            s3Key: true,
            folderType: true,
          },
        },
        monthlyDeliverable: true,
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

    // Map and add signed URLs
    const payload = await Promise.all(
      tasks.map(async (t) => {
        // Convert BigInt size to number
        const mappedFiles = t.files.map((f) => ({
          ...f,
          size: Number(f.size),
        }));

        const filesWithUrls = await addSignedUrlsToFiles(mappedFiles);

        return {
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
          transcript: t.transcript,
          transcriptSummary: t.transcriptSummary,
          suggestedTitles: t.suggestedTitles,
          platform: t.platform,
          socialMediaLinks: t.socialMediaLinks || [],
          priority: t.priority,
          client: t.client,
          files: filesWithUrls,
          titlingJob: (t as any).titlingJob || null,
          monthlyDeliverable: t.monthlyDeliverable ? {
            id: t.monthlyDeliverable.id,
            type: t.monthlyDeliverable.type,
            quantity: t.monthlyDeliverable.quantity,
            videosPerDay: t.monthlyDeliverable.videosPerDay,
            postingSchedule: t.monthlyDeliverable.postingSchedule,
            postingDays: t.monthlyDeliverable.postingDays,
            postingTimes: t.monthlyDeliverable.postingTimes,
            platforms: t.monthlyDeliverable.platforms,
            description: t.monthlyDeliverable.description
          } : null,
        };
      })
    );

    // Return in the format expected by SchedulerApprovedQueuePage
    return NextResponse.json({ tasks: payload }, { status: 200 });

  } catch (err: any) {
    console.error("GET /api/schedular/tasks error:", err);
    return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
  }
}
