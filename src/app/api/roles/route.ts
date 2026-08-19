export const dynamic = 'force-dynamic';
// src/app/api/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { inArray, and, eq } from 'drizzle-orm';
import { cached } from '@/lib/redis';

const taskTypeRoleMap: Record<string, string[]> = {
  design: ["admin"],
  video: ["editor"],
  review: ["qc_specialist"],
  schedule: ["scheduler"],
  copywriting: ["editor"],
  audit: ["qc_specialist"],
  coordination: ["scheduler"],
};

export async function GET(req: NextRequest) {
  const db = getDbHttp();
  const { searchParams } = new URL(req.url);
  const taskType = searchParams.get("taskType");
  const all = searchParams.get("all");

  try {
    if (all === "true") {
      // Active staff only — used by Create Task / reassign dropdowns
      const users = await cached(
        "users:all:active",
        async () => {
          return db.select({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            roles: user.roles,
          }).from(user).where(eq(user.employeeStatus, "ACTIVE" as any));
        },
        600 // 10 minutes
      );

      return NextResponse.json({ users }, { status: 200 });
    }

    if (!taskType) {
      return NextResponse.json(
        { error: "taskType is required" },
        { status: 400 }
      );
    }

    const allowedRoles = taskTypeRoleMap[taskType] || [];

    const roleUsers = await cached(
      `users:role:active:${taskType}`,
      async () => {
        return db.select({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          roles: user.roles,
        })
          .from(user)
          .where(and(
            inArray(user.role, allowedRoles as any),
            eq(user.employeeStatus, "ACTIVE" as any),
          ));
      },
      600 // 10 minutes
    );

    return NextResponse.json({ allowedRoles, roleUsers }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}