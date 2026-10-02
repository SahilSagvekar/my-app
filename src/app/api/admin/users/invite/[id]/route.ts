export const dynamic = "force-dynamic";
// DELETE /api/admin/users/invite/[id] — revoke a pending invite
// POST   /api/admin/users/invite/[id] — resend (rotates the token, extends expiry)

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { user as userTable, userInvite } from "@/lib/db/schema";
import { getUserFromToken, getJwtUserId } from "@/lib/auth-helpers";
import { buildInviteUrl, generateInviteToken, hashInviteToken, inviteExpiryIso } from "@/lib/invites";
import { sendInviteEmail } from "@/lib/invite-email";

function canInvite(role?: string) {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "manager";
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = getUserFromToken(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canInvite(me.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = getDbHttp();
  const [invite] = await db.select().from(userInvite).where(eq(userInvite.id, id)).limit(1);
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.status === "ACCEPTED") {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });
  }

  await db
    .update(userInvite)
    .set({ status: "REVOKED", updatedAt: new Date().toISOString() })
    .where(eq(userInvite.id, id));
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = getUserFromToken(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canInvite(me.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const myId = getJwtUserId(me);

  const { id } = await params;
  const db = getDbHttp();
  const [invite] = await db.select().from(userInvite).where(eq(userInvite.id, id)).limit(1);
  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.status === "ACCEPTED") {
    return NextResponse.json({ error: "Invite already accepted" }, { status: 409 });
  }

  const token = generateInviteToken();
  await db
    .update(userInvite)
    .set({
      tokenHash: await hashInviteToken(token),
      status: "PENDING",
      expiresAt: inviteExpiryIso(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(userInvite.id, id));

  const [inviter] = myId
    ? await db.select({ name: userTable.name }).from(userTable).where(eq(userTable.id, myId)).limit(1)
    : [];

  const inviteUrl = buildInviteUrl(token);
  const mail = await sendInviteEmail({
    email: invite.email,
    name: invite.name,
    role: invite.role,
    inviterName: inviter?.name,
    inviteUrl,
  });

  return NextResponse.json({ ok: true, emailSent: mail.success, ...(mail.success ? {} : { inviteUrl }) });
}
