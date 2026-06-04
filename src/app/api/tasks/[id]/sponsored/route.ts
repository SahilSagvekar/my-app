export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    const task = await prisma.task.update({
      where: { id },
      data: { isSponsored },
      select: { id: true, isSponsored: true },
    });

    return NextResponse.json(task);
  } catch (err: any) {
    console.error("Error updating sponsored status:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
