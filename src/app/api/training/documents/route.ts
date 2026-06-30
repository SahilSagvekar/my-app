export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2, requireAdmin } from "@/lib/auth";
import { uploadBufferToS3, generateSignedUrl } from "@/lib/s3";
import { Role } from "@prisma/client";

const ROLES_WITH_TRAINING = ["editor", "qc", "scheduler", "manager", "videographer", "sales", "admin"] as const;
type TrainingRole = (typeof ROLES_WITH_TRAINING)[number];

function isTrainingRole(r: string): r is TrainingRole {
  return ROLES_WITH_TRAINING.includes(r as TrainingRole);
}

// GET – list training documents
// - Admin/manager: all or filter by role/courseId
// - Others: only for their role
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
      where.role = filterRole as Role;
    }
    if (courseId) {
      where.courseId = courseId;
    }

    const documents = await prisma.trainingDocument.findMany({
      where,
      orderBy: courseId
        ? [{ order: "asc" }]
        : [{ role: "asc" }, { order: "asc" }],
    });

    // Sign S3/R2 URLs for downloads
    const signedDocuments = await Promise.all(
      documents.map(async (doc) => {
        try {
          // Expiry set to 2 hours (7200 seconds)
          const signedUrl = await generateSignedUrl(doc.s3Key, 7200);
          return {
            ...doc,
            url: signedUrl,
          };
        } catch (err) {
          console.error(`Failed to sign training document URL for ${doc.id}:`, err);
          return {
            ...doc,
            url: null,
          };
        }
      })
    );

    return NextResponse.json({ documents: signedDocuments });
  } catch (err) {
    console.error("GET /api/training/documents error:", err);
    return NextResponse.json({ error: "Failed to fetch training documents" }, { status: 500 });
  }
}

// POST – create/upload training document (admin/manager only)
// Body: FormData containing file, title, description, role, order
export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin(req);

    const formData = await req.formData();
    const title = formData.get("title") as string | null;
    const description = (formData.get("description") as string | null) || "";
    const role = formData.get("role") as string | null;
    const orderStr = formData.get("order") as string | null;
    const file = formData.get("file") as File | null;
    const courseId = formData.get("courseId") as string | null;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!role || !isTrainingRole(role)) {
      return NextResponse.json({ error: "Valid training role is required" }, { status: 400 });
    }

    const order = orderStr ? parseInt(orderStr, 10) : 0;

    // Check size limit (max 25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
    }

    // Upload to S3/R2
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folderPrefix = `training-documents/${role}/`;

    const upload = await uploadBufferToS3({
      buffer,
      folderPrefix,
      filename: `${Date.now()}_${safeName}`,
      mimeType: file.type,
    });

    const document = await prisma.trainingDocument.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        s3Key: upload.key,
        fileName: file.name,
        fileSize: file.size,
        role: role as Role,
        order: isNaN(order) ? 0 : order,
        courseId: courseId || null,
      },
    });

    return NextResponse.json({ document });
  } catch (err: any) {
    console.error("POST /api/training/documents error:", err);
    const status = err?.status || 500;
    const msg = err?.message || "Failed to upload training document";
    return NextResponse.json({ error: msg }, { status });
  }
}
