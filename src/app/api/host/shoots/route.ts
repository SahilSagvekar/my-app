export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { shootDetail } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

// Host Portal — "My Shoots". E8 assigns hosts directly (no accept/decline
// flow, per product decision), so this only ever returns already-decided
// bookings: confirmed (has a shoot date in the future, not cancelled) and
// past (shoot date has passed, or the shoot was cancelled).

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

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
    const hostId = Number(user.userId || user.id);
    if (!hostId || Number.isNaN(hostId)) {
      return NextResponse.json({ ok: false, message: "Invalid user" }, { status: 400 });
    }

    const shoots = await db.query.shootDetail.findMany({
      where: eq(shootDetail.hostId, hostId),
      with: {
        task: { with: { client: { columns: { id: true, name: true, companyName: true } } } },
        user: { columns: { id: true, name: true, email: true } }, // videographer
      },
      orderBy: (s, { desc }) => desc(s.shootDate),
    });

    const now = new Date();
    const confirmed: any[] = [];
    const past: any[] = [];

    for (const s of shoots) {
      const row = {
        id: s.id,
        clientName: s.task?.client?.companyName || s.task?.client?.name || "Client",
        shootDate: s.shootDate,
        callTime: s.plannedStartTime,
        location: s.location,
        wardrobe: s.hostWardrobe,
        role: s.hostRole,
        videographer: s.user ? (s.user.name || s.user.email) : null,
        rate: s.hostRate,
        notes: s.videographerNotes,
        cancelled: !!s.cancelledAt,
      };
      const isPast = s.cancelledAt || !s.shootDate || new Date(s.shootDate) < now;
      (isPast ? past : confirmed).push(row);
    }

    // Confirmed shoots soonest-first; past shoots most-recent-first (already
    // sorted desc by shootDate from the query).
    confirmed.sort((a, b) => new Date(a.shootDate).getTime() - new Date(b.shootDate).getTime());

    return NextResponse.json({ ok: true, confirmed, past });
  } catch (err: any) {
    console.error("GET /api/host/shoots error:", err);
    return NextResponse.json({ ok: false, message: err?.message || "Something went wrong" }, { status: 500 });
  }
}
