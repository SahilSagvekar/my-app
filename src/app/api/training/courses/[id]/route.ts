export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from '@/lib/db';
import { trainingCourse } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq, asc } from 'drizzle-orm';
import { getCurrentUser2 } from "@/lib/auth";

const ROLES_WITH_TRAINING = ["editor", "qc", "scheduler", "manager", "videographer", "sales", "sales_manager", "admin"] as const;
type TrainingRole = (typeof ROLES_WITH_TRAINING)[number];

function isTrainingRole(r: string): r is TrainingRole {
  return ROLES_WITH_TRAINING.includes(r as TrainingRole);
}

// GET – list training courses
// - Admin/manager: all or filter by role
// - Others: only for their role
export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roleParam = searchParams.get("role");

    const isAdminOrManager = user.role === "admin" || user.role === "manager";
    const filterRole = isAdminOrManager && roleParam && isTrainingRole(roleParam)
      ? roleParam
      : isAdminOrManager
        ? null
        : user.role && isTrainingRole(user.role)
          ? (user.role as TrainingRole)
          : null;

    const courses = await db.select().from(trainingCourse)
      .where(filterRole ? eq(trainingCourse.role, filterRole) : undefined)
      .orderBy(asc(trainingCourse.role), asc(trainingCourse.order));

    return NextResponse.json({ courses });
  } catch (err) {
    console.error("GET /api/training/courses error:", err);
    return NextResponse.json({ error: "Failed to fetch training courses" }, { status: 500 });
  }
}

// POST – create training course (admin/manager only)
export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (user.role !== "admin" && user.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, role, order } = body as {
      title?: string;
      description?: string;
      role?: string;
      order?: number;
    };

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!role || !isTrainingRole(role)) {
      return NextResponse.json({ error: "Valid role is required (editor, qc, scheduler, manager, videographer, sales)" }, { status: 400 });
    }

    const safeOrder = typeof order === "number" && !isNaN(order) ? order : 0;

    const [course] = await db.insert(trainingCourse).values({
      id: createId(),
      title: title.trim(),
      description: (description || "").trim(),
      role: role as TrainingRole,
      order: safeOrder,
      updatedAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({ course }, { status: 201 });
  } catch (err) {
    console.error("POST /api/training/courses error:", err);
    return NextResponse.json({ error: "Failed to create training course" }, { status: 500 });
  }
}
