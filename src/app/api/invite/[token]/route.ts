export const dynamic = "force-dynamic";
// GET /api/invite/[token] — public. Lets the register page validate an
// emailed invite link and prefill name/email/role. Returns nothing sensitive.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { userInvite } from "@/lib/db/schema";
import { hashInviteToken } from "@/lib/invites";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 32) {
    return NextResponse.json({ valid: false, reason: "invalid" }, { status: 404 });
  }

  const db = getDbHttp();
  const [invite] = await db
    .select()
    .from(userInvite)
    .where(eq(userInvite.tokenHash, await hashInviteToken(token)))
    .limit(1);

  if (!invite) return NextResponse.json({ valid: false, reason: "invalid" }, { status: 404 });
  if (invite.status === "ACCEPTED") return NextResponse.json({ valid: false, reason: "used" }, { status: 410 });
  if (invite.status === "REVOKED") return NextResponse.json({ valid: false, reason: "revoked" }, { status: 410 });
  if (new Date(invite.expiresAt + "Z").getTime() < Date.now()) {
    return NextResponse.json({ valid: false, reason: "expired" }, { status: 410 });
  }

  return NextResponse.json({
    valid: true,
    email: invite.email,
    name: invite.name,
    role: invite.role,
  });
}
