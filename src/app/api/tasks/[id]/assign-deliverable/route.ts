import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/authToken=([^;]+)/);
  return m ? m[1] : null;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role } = decoded;
    if (!["scheduler", "manager", "admin"].includes((role || "").toLowerCase())) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { deliverableId } = await req.json();
    if (!deliverableId) {
      return NextResponse.json({ message: "deliverableId required" }, { status: 400 });
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        monthlyDeliverableId: deliverableId,
        updatedAt: new Date(),
      },
      include: { monthlyDeliverable: true },
    });

    return NextResponse.json({ task: {
      id: updated.id,
      monthlyDeliverableId: updated.monthlyDeliverableId,
      deliverable: updated.monthlyDeliverable
    } }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/tasks/:id/assign-deliverable error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
