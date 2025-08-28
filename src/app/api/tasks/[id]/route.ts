import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id'); 
    const body = await req.json();
    const { status } = body;
    console.log("Updating task:", { id, status });

    if (!id || !status) {
      return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    }

    const updatedTask = await prisma.task.update({
      where: { id: String(id) }, // ensure ID is a string
      data: { status }
    });

    return NextResponse.json(updatedTask);
  } catch (err) {
    console.error("Error updating task:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
