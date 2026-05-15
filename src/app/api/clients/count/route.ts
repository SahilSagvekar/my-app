export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/redis";

// Lightweight endpoint — returns only the count of active clients.
// UserManagementTab needs a number, not full client objects.
export async function GET() {
  try {
    const count = await cached(
      "clients:count",
      () => prisma.client.count({ where: { status: "active" } }),
      300 // 5 min TTL — count doesn't change often
    );
    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json({ count: 0 }, { status: 500 });
  }
}