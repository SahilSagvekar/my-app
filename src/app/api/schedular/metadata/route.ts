import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { client, monthlyDeliverable, oneOffDeliverable, user } from "@/lib/db/schema";
import { and, or, eq, arrayContains, asc, sql as drizzleSql } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export async function GET() {
  const { db, closeDb } = getDb();
  try {
  try {
    // 1. Fetch all unique clients that have tasks in completed/scheduled status
    const clients = await db.select({
      id: client.id,
      name: client.name,
      companyName: client.companyName,
    }).from(client).orderBy(asc(client.name));

    // 2. Fetch all unique deliverable types across both tables
    const [monthlyTypes, oneOffTypes] = await Promise.all([
      db.selectDistinct({ type: monthlyDeliverable.type }).from(monthlyDeliverable),
      db.selectDistinct({ type: oneOffDeliverable.type }).from(oneOffDeliverable),
    ]);

    const uniqueTypes = Array.from(new Set([
      ...monthlyTypes.map(d => d.type),
      ...oneOffTypes.map(d => d.type),
    ])).filter(Boolean).sort();

    // 3. Editors — anyone whose primary role or additional roles[] includes
    // "editor", so multi-role accounts (e.g. Daena: editor + scheduler + qc)
    // show up here too, not just single-role editors.
    const editors = await db.select({ id: user.id, name: user.name }).from(user)
      .where(and(
        eq(user.employeeStatus, 'ACTIVE'),
        or(eq(user.role, 'editor'), arrayContains(user.roles, ['editor'])),
      ))
      .orderBy(asc(user.name));

    return NextResponse.json({
      clients,
      deliverableTypes: uniqueTypes,
      editors,
    });
  } catch (err: any) {
    console.error("GET /api/schedular/metadata error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}