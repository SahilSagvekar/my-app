export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { task as taskTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser2 } from "@/lib/auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser2(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: taskId } = await params;
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { imageOrder } = body;

    if (!Array.isArray(imageOrder)) {
      return NextResponse.json(
        { error: "imageOrder must be an array of file IDs" },
        { status: 400 }
      );
    }

    const db = getDbHttp();
    const existing = await db.query.task.findFirst({
      where: eq(taskTable.id, taskId),
      columns: { id: true, attachments: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const currentAttachments =
      existing.attachments && typeof existing.attachments === "object"
        ? (existing.attachments as Record<string, any>)
        : {};

    const updatedAttachments = {
      ...currentAttachments,
      imageOrder: imageOrder.map(String),
    };

    await db
      .update(taskTable)
      .set({ attachments: updatedAttachments })
      .where(eq(taskTable.id, taskId));

    return NextResponse.json({
      success: true,
      taskId,
      imageOrder: updatedAttachments.imageOrder,
    });
  } catch (error: any) {
    console.error("Error updating image order:", error);
    return NextResponse.json(
      { error: "Failed to update image order", message: error.message },
      { status: 500 }
    );
  }
}
