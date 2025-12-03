import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    await requireAdmin(req);

    const employees = await prisma.user.findMany({
      where: {
        role: { notIn: ["admin", "client"] }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ ok: true, employees });
  } catch (err: any) {
    return NextResponse.json({ ok: false, message: err?.message }, { status: 400 });
  }
}
