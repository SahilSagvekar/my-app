import { NextResponse } from "next/server";
import { getCurrentUser2 } from "@/lib/auth";
import { TaskService } from "@/services/taskService";
import "@/lib/bigint-fix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ServerTiming } from "@/lib/server-timing";

export async function GET(req: any) {
  const timing = new ServerTiming();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { role, id: userId } = user;
    const { searchParams } = new URL(req.url);

    const filters = {
      status: searchParams.get("status") || undefined,
      clientId: searchParams.get("clientId") || undefined,
      month: searchParams.get("month") || undefined,
    };

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "25");
    const isAdmin = role?.toLowerCase() === 'admin';
    const isPaginationActive = isAdmin && (searchParams.has("page") || searchParams.has("limit"));

    const tasks = await TaskService.getTasks(role, Number(userId), filters, timing);
    
    timing.start('meta');
    const availableMonths = await TaskService.getAvailableMonths();
    timing.stop('meta');

    let finalTasks = tasks;
    let paginationMeta = null;

    if (isPaginationActive) {
      const total = tasks.length;
      finalTasks = tasks.slice((page - 1) * limit, page * limit);
      paginationMeta = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    }

    // 🔥 OPTIMIZATION: Only sign files for the final results
    finalTasks = await TaskService.signTaskFiles(finalTasks, timing);

    return NextResponse.json({
      tasks: TaskService.sanitizeBigInt(finalTasks),
      availableMonths,
      ...(paginationMeta && { pagination: paginationMeta })
    }, { 
      status: 200,
      headers: {
        'Server-Timing': timing.getHeaderValue()
      }
    });

  } catch (err: any) {
    console.error("❌ GET /api/tasks error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: any) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { role, id: userId } = user;
    const isEditor = role?.toLowerCase() === 'editor';

    if (!role || (!["admin", "manager"].includes(role.toLowerCase()) && !isEditor)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const form = await req.formData();
    const data: any = {};
    const files: File[] = [];

    // Extract all fields from form
    for (const [key, value] of form.entries()) {
      if (value instanceof File) {
        files.push(value);
      } else {
        data[key] = value;
      }
    }

    // Permission check for Editors
    if (isEditor) {
      if (!data.clientId || !data.oneOffDeliverableId) {
        return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
      }
      const { prisma } = await import("@/lib/prisma");
      const perm = await (prisma as any).editorClientPermission.findUnique({
        where: { editorId_clientId: { editorId: Number(userId), clientId: data.clientId } },
      });
      if (!perm) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const task = await TaskService.createTask(data, files, user);
    return NextResponse.json(TaskService.sanitizeBigInt(task), { status: 201 });

  } catch (err: any) {
    console.error("❌ POST /api/tasks error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}
