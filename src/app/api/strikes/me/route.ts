export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser2 } from "@/lib/auth";
import { getStrikeSummary } from "@/lib/strikes";

// GET /api/strikes/me — the signed-in user's own strikes (count, reasons, who sent
// each one, and revoked ones flagged). Drives the always-visible header indicator.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const summary = await getStrikeSummary(user.id);
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error("❌ /api/strikes/me error:", err?.message || err);
    return NextResponse.json({ error: "Failed to load strikes" }, { status: 500 });
  }
}
