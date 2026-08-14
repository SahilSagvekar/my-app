export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { task } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { id } = await params;
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role } = decoded;

    if (!["editor", "admin", "manager"].includes(role.toLowerCase())) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { isSponsored } = await req.json();
    if (typeof isSponsored !== "boolean") {
      return NextResponse.json({ message: "isSponsored must be a boolean" }, { status: 400 });
    }

    const [updatedTask] = await db.update(task).set({
      isSponsored,
      updatedAt: new Date().toISOString(),
    }).where(eq(task.id, id)).returning({ id: task.id, isSponsored: task.isSponsored });

    return NextResponse.json(updatedTask);
  } catch (err: any) {
    console.error("Error updating sponsored status:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}
