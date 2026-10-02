export const dynamic = "force-dynamic";
// GET /api/dev-portal/assignees — people a ticket can be assigned to
// (admins + anyone with Dev Portal access).

import { NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { DEV_PORTAL_EMAILS, getDevPortalAuth } from "@/lib/dev-portal";

export async function GET(req: NextRequest) {
  const auth = getDevPortalAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!auth.hasPortal) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = getDbHttp();
  const rows = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email })
    .from(userTable)
    .where(or(eq(userTable.role, "admin"), ...DEV_PORTAL_EMAILS.map((e) => eq(userTable.email, e))));

  return NextResponse.json({
    users: rows.map((r) => ({ id: r.id, name: r.name || r.email })).sort((a, b) => a.name.localeCompare(b.name)),
  });
}
