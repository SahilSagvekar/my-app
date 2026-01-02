// src/app/api/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
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
  const { searchParams } = new URL(req.url);
  const taskType = searchParams.get("taskType");
  const all = searchParams.get("all");

  try {
    if (all === "true") {
      const users = await cached(
        "users:all",
        async () => {
          return prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true },
          });
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
      `users:role:${taskType}`,
      async () => {
        return prisma.user.findMany({
          where: { role: { in: allowedRoles } },
          select: { id: true, name: true, email: true, role: true },
        });
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