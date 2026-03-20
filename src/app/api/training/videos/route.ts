export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";
import { uploadBufferToS3, isObjectStorageUrl, extractS3KeyFromUrl, generateSignedUrl } from "@/lib/s3";

const ROLES_WITH_TRAINING = ["editor", "qc", "scheduler", "manager", "videographer", "sales", "admin"] as const;
type TrainingRole = (typeof ROLES_WITH_TRAINING)[number];

function isTrainingRole(r: string): r is TrainingRole {
  return ROLES_WITH_TRAINING.includes(r as TrainingRole);
}

// GET – list training videos
// - Admin/manager: all or filter by role/courseId
// - Others: only for their role; when courseId is passed, restricted to that course
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roleParam = searchParams.get("role");
    const courseId = searchParams.get("courseId");

    const isAdminOrManager = user.role === "admin" || user.role === "manager";
    const filterRole = isAdminOrManager && roleParam && isTrainingRole(roleParam)
      ? roleParam
      : isAdminOrManager
        ? null
        : user.role && isTrainingRole(user.role)
          ? (user.role as TrainingRole)
          : null;

    const where: any = {};
    if (filterRole) {
      where.role = filterRole;
    }
    if (courseId) {
      where.courseId = courseId;
    }

    const videos = await prisma.trainingVideo.findMany({
      where,
      orderBy: courseId
        ? [{ order: "asc" }]
        : [{ role: "asc" }, { order: "asc" }],
    });

    // Sign R2/S3 URLs for playback (external URLs are left as-is)
    const signedVideos = await Promise.all(
      videos.map(async (video) => {
        if (!isObjectStorageUrl(video.videoUrl)) {
          return video; // External URL (YouTube, pasted link, etc.) — no signing needed
        }
        try {
          const s3Key = extractS3KeyFromUrl(video.videoUrl);
          if (s3Key) {
            const signedUrl = await generateSignedUrl(s3Key, 7200); // 2 hours
            return { ...video, videoUrl: signedUrl };
          }
        } catch (err) {
          console.error(`Failed to sign training video URL for ${video.id}:`, err);
        }
        return video;
      })
    );

    return NextResponse.json({ videos: signedVideos });
  } catch (err) {
    console.error("GET /api/training/videos error:", err);
    return NextResponse.json({ error: "Failed to fetch training videos" }, { status: 500 });
  }
}

// POST – create training video (admin/manager only)
// Body: FormData with file OR videoUrl + title, description, role, order
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const title = formData.get("title") as string | null;
    const description = (formData.get("description") as string | null) || "";
    const role = formData.get("role") as string | null;
    const orderStr = formData.get("order") as string | null;
    const file = formData.get("file") as File | null;
    const videoUrlFromInput = formData.get("videoUrl") as string | null;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!role || !isTrainingRole(role)) {
      return NextResponse.json({ error: "Valid role is required (editor, qc, scheduler, manager, videographer, sales)" }, { status: 400 });
    }

    let videoUrl: string;

    if (file && file.size > 0) {
      // Upload to Cloudflare R2 via S3-compatible API
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Generate a unique filename
      const ext = file.name.split('.').pop() || 'mp4';
      const sanitizedTitle = title.trim().replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const uniqueFilename = `${sanitizedTitle}-${Date.now()}.${ext}`;

      const uploaded = await uploadBufferToS3({
        buffer,
        folderPrefix: "training-videos/",
        filename: uniqueFilename,
        mimeType: file.type || "video/mp4",
      });

      videoUrl = uploaded.url;
    } else if (videoUrlFromInput && videoUrlFromInput.trim().startsWith("http")) {
      videoUrl = videoUrlFromInput.trim();
    } else {
      return NextResponse.json({ error: "Either a video file or a video URL is required" }, { status: 400 });
    }

    const order = orderStr != null && orderStr !== "" ? parseInt(orderStr, 10) : 0;
    const safeOrder = isNaN(order) ? 0 : order;

    const video = await prisma.trainingVideo.create({
      data: {
        title: title.trim(),
        description: (description || "").trim(),
        videoUrl,
        role: role as TrainingRole,
        order: safeOrder,
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (err) {
    console.error("POST /api/training/videos error:", err);
    return NextResponse.json({ error: "Failed to create training video" }, { status: 500 });
  }
}