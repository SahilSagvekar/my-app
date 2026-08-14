export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { client } from "@/lib/db/schema";
import { eq, count as countFn } from "drizzle-orm";
import { cached } from "@/lib/redis";

// Lightweight endpoint — returns only the count of active clients.
// UserManagementTab needs a number, not full client objects.
export async function GET() {
  const { db, closeDb } = getDb();
  try {
  try {
    const count = await cached(
      "clients:count",
      async () => {
        const [{ value }] = await db.select({ value: countFn() }).from(client).where(eq(client.status, "active"));
        return value;
      },
      300 // 5 min TTL — count doesn't change often
    );
    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}