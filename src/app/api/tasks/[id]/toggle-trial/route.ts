// src/app/api/tasks/[id]/toggle-trial/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value || cookieStore.get("authToken")?.value;
  if (!token) return null;
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; role: string };
    return decoded;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only scheduler, manager, admin can toggle trial
    if (!["scheduler", "manager", "admin"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isTrial } = body;

    if (typeof isTrial !== "boolean") {
      return NextResponse.json({ error: "isTrial must be boolean" }, { status: 400 });
    }

    const task = await prisma.task.update({
      where: { id },
      data: { isTrial },
      select: {
        id: true,
        isTrial: true,
      },
    });

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Toggle trial error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}