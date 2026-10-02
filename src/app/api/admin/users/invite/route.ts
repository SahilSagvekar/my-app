export const dynamic = "force-dynamic";
// POST /api/admin/users/invite  — admin/manager invites a new user by email
// GET  /api/admin/users/invite  — list invites (pending first)

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { user as userTable, userInvite, auditLog } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { getUserFromToken, getJwtUserId } from "@/lib/auth-helpers";
import {
  buildInviteUrl,
  generateInviteToken,
  hashInviteToken,
  inviteExpiryIso,
  isInvitableRole,
} from "@/lib/invites";
import { sendInviteEmail } from "@/lib/invite-email";

function canInvite(role?: string) {
  const r = (role || "").toLowerCase();
  return r === "admin" || r === "manager";
}

export async function GET(req: NextRequest) {
  const me = getUserFromToken(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canInvite(me.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDbHttp();
  const rows = await db
    .select({
      id: userInvite.id,
      email: userInvite.email,
      name: userInvite.name,
      role: userInvite.role,
      status: userInvite.status,
      expiresAt: userInvite.expiresAt,
      acceptedAt: userInvite.acceptedAt,
      createdAt: userInvite.createdAt,
      invitedByName: userTable.name,
    })
    .from(userInvite)
    .leftJoin(userTable, eq(userTable.id, userInvite.invitedById))
    .orderBy(desc(userInvite.createdAt))
    .limit(100);

  const now = Date.now();
  return NextResponse.json({
    invites: rows.map((r) => ({
      ...r,
      // Surface lapsed invites as EXPIRED without needing a cron to flip them.
      status: r.status === "PENDING" && new Date(r.expiresAt + "Z").getTime() < now ? "EXPIRED" : r.status,
    })),
  });
}

export async function POST(req: NextRequest) {
  const me = getUserFromToken(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canInvite(me.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const myId = getJwtUserId(me);
  if (!myId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const name = body?.name ? String(body.name).trim() : null;
  const role = body?.role;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (!isInvitableRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  // Only admins can mint other admins.
  if (role === "admin" && (me.role || "").toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Only admins can invite admins" }, { status: 403 });
  }

  const db = getDbHttp();

  const [existing] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // One live invite per email: revoke any earlier pending one so only the
  // newest link works.
  const nowIso = new Date().toISOString();
  await db
    .update(userInvite)
    .set({ status: "REVOKED", updatedAt: nowIso })
    .where(and(eq(userInvite.email, email), eq(userInvite.status, "PENDING")));

  const token = generateInviteToken();
  const [invite] = await db
    .insert(userInvite)
    .values({
      id: createId(),
      email,
      name,
      role,
      tokenHash: await hashInviteToken(token),
      invitedById: myId,
      expiresAt: inviteExpiryIso(),
      updatedAt: nowIso,
    })
    .returning({ id: userInvite.id, expiresAt: userInvite.expiresAt });

  const [inviter] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, myId))
    .limit(1);

  const inviteUrl = buildInviteUrl(token);
  const mail = await sendInviteEmail({
    email,
    name,
    role,
    inviterName: inviter?.name,
    inviteUrl,
  });

  await db.insert(auditLog).values({
    userId: myId,
    action: "USER_INVITED",
    entity: "UserInvite",
    entityId: invite.id,
    details: `Invited ${email} as ${role}`,
  } as any);

  return NextResponse.json({
    ok: true,
    invite: { id: invite.id, email, role, expiresAt: invite.expiresAt },
    emailSent: mail.success,
    // If SMTP failed the admin can still hand over the link manually.
    ...(mail.success ? {} : { inviteUrl }),
  });
}
