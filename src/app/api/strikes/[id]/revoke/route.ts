export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser2 } from "@/lib/auth";
import { keepAlive } from "@/lib/keep-alive";
import { StrikeError, notifyStrikeRevoked, revokeStrike } from "@/lib/strikes";

// POST /api/strikes/[id]/revoke  { reason?: string } — admin only.
// The strike stays in the recipient's history, flagged as revoked. A terminated
// account is NOT reinstated automatically (recipientStillTerminated tells the UI).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const result = await revokeStrike({
      actor: {
        id: user.id,
        role: user.role,
        roles: ((user.roles as string[] | null) ?? []).map(String),
        employeeStatus: user.employeeStatus,
      },
      strikeId: id,
      reason: body?.reason,
    });

    keepAlive(notifyStrikeRevoked(result));

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    if (err instanceof StrikeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("❌ POST /api/strikes/[id]/revoke error:", err?.message || err);
    return NextResponse.json({ error: "Failed to revoke strike" }, { status: 500 });
  }
}
