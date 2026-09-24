export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { shootDetail } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

function getUserFromToken(req: NextRequest) {
  try {
    const token = req.cookies.get('authToken')?.value;
    if (!token) return null;
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.user || decoded.currentUser || decoded;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    const hostId = Number(user.userId || user.id);
    const { id } = await context.params;

    const shoot = await db.query.shootDetail.findFirst({
      where: eq(shootDetail.id, id),
      with: {
        task: { with: { client: { columns: { id: true, name: true, companyName: true } } } },
        user: { columns: { id: true, name: true, email: true } },
      },
    });

    if (!shoot) {
      return NextResponse.json({ ok: false, message: "Shoot not found" }, { status: 404 });
    }

    // 🔒 A host can only ever read their own bookings.
    if (shoot.hostId !== hostId) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      shoot: {
        id: shoot.id,
        clientName: shoot.task?.client?.companyName || shoot.task?.client?.name || "Client",
        shootDate: shoot.shootDate,
        callTime: shoot.plannedStartTime,
        location: shoot.location,
        wardrobe: shoot.hostWardrobe,
        role: shoot.hostRole,
        videographer: shoot.user ? (shoot.user.name || shoot.user.email) : null,
        rate: shoot.hostRate,
        notes: shoot.videographerNotes,
        cancelled: !!shoot.cancelledAt,
      },
    });
  } catch (err: any) {
    console.error("GET /api/host/shoots/[id] error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Something went wrong" }, { status: 500 });
  }
}
