export const dynamic = 'force-dynamic';
// src/app/api/tasks/[id]/no-action-required/route.ts
//
// Editor explicitly confirms none of the Task Actions (tag/script/raw
// footage/long-form/sponsor) apply to this task. This — or at least one
// real action — is required before Submit to QC (enforced in
// /api/tasks/[id]/status). Setting any real action elsewhere auto-clears
// this flag server-side (see /sponsored, /tags, /link-lf, /link-raw-footage,
// /script); this route only ever sets the value the editor explicitly chose.

import { NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
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
  const db = getDbHttp();
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

    const { noActionRequired } = await req.json();
    if (typeof noActionRequired !== "boolean") {
      return NextResponse.json({ message: "noActionRequired must be a boolean" }, { status: 400 });
    }

    const [updatedTask] = await db.update(task).set({
      noActionRequired,
      updatedAt: new Date().toISOString(),
    }).where(eq(task.id, id)).returning({ id: task.id, noActionRequired: task.noActionRequired });

    return NextResponse.json(updatedTask);
  } catch (err: any) {
    console.error("Error updating noActionRequired:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}