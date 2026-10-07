export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser2 } from "@/lib/auth";
import { keepAlive } from "@/lib/keep-alive";
import {
  StrikeError,
  isAdminActor,
  listEligibleRecipients,
  listStrikeHistory,
  notifyStrikeSent,
  sendStrike,
  strikerKind,
  MAX_STRIKES,
} from "@/lib/strikes";

function actorFrom(user: any) {
  return {
    id: user.id as number,
    name: (user.name as string | null) ?? null,
    role: user.role as string | null,
    roles: ((user.roles as string[] | null) ?? []).map(String),
    employeeStatus: user.employeeStatus as string | null,
  };
}

// GET /api/strikes — admin/videographer only.
//   eligible: people this user may strike (with their current active count)
//   history:  admin -> every strike; videographer -> strikes they sent
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = actorFrom(user);
    if (!strikerKind(actor)) {
      return NextResponse.json({ error: "Only admins and videographers can send strikes" }, { status: 403 });
    }

    const [eligible, history] = await Promise.all([
      listEligibleRecipients(actor),
      listStrikeHistory(actor),
    ]);

    return NextResponse.json({
      max: MAX_STRIKES,
      canRevoke: isAdminActor(actor),
      eligible,
      history,
    });
  } catch (err: any) {
    console.error("❌ GET /api/strikes error:", err?.message || err);
    return NextResponse.json({ error: "Failed to load strikes" }, { status: 500 });
  }
}

// POST /api/strikes  { recipientId: number, reason: string }
// The 3rd active strike terminates the recipient (see src/lib/strikes.ts).
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const recipientId = Number(body?.recipientId);

    const result = await sendStrike({
      actor: actorFrom(user),
      recipientId,
      reason: body?.reason,
    });

    // Slack / email / in-app run after the response is sent.
    keepAlive(notifyStrikeSent(result));

    return NextResponse.json({
      success: true,
      strikeId: result.strikeId,
      recipient: { id: result.recipient.id, name: result.recipient.name },
      activeCount: result.activeCount,
      max: MAX_STRIKES,
      terminated: result.terminated,
    });
  } catch (err: any) {
    if (err instanceof StrikeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("❌ POST /api/strikes error:", err?.message || err);
    return NextResponse.json({ error: "Failed to send strike" }, { status: 500 });
  }
}
