// src/app/api/roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  if (!taskType) {
    return NextResponse.json({ error: "taskType is required" }, { status: 400 });
  }

  try {
    const allowedRoles = taskTypeRoleMap[taskType] || [];

    console.log("Received allowedRoles:", allowedRoles);

    const roleUsers = await prisma.user.findMany({
      where: { role: { in: allowedRoles } },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ allowedRoles, roleUsers }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
