// FILE: src/app/api/time-clock/clients/route.ts
// Clients a person can send their start-of-day report to: only active clients
// that have a Slack channel wired up. Used by the clock-in dialog's dropdown.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { getDbHttp } from "@/lib/db";
import { client as clientTable } from "@/lib/db/schema";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getDbHttp();
    const rows = await db
      .select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName })
      .from(clientTable)
      .where(
        and(
          eq(clientTable.slackEnabled, true),
          isNotNull(clientTable.slackWebhookUrl),
          eq(clientTable.status, "active"),
        ),
      )
      .orderBy(asc(clientTable.companyName), asc(clientTable.name));

    return NextResponse.json({
      clients: rows.map((c) => ({ id: c.id, name: c.companyName || c.name })),
    });
  } catch (err) {
    console.error("❌ /api/time-clock/clients error:", err);
    return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  }
}
