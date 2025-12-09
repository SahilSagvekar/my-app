import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const employees = await prisma.user.findMany({
      where: {
        OR: [
          { role: null }, // Include users with no role
          { role: { notIn: ["admin", "client"] } } // Include non-admin/client roles
        ]
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ ok: true, employees });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message }, { status: 400 });
  }
}