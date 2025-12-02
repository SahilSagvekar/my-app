import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";

const BonusSchema = z.object({
  amount: z.number().positive(),
  addedBy: z.number().optional(), // or use req user id
});

export async function POST(req: Request, context: { params: { id: string } }) {
  try {
    await requireAdmin(req as any);
    const { params } = await Promise.resolve(context);
    const employeeId = Number(params.id);
    const body = BonusSchema.parse(await req.json());

    const bonus = await prisma.bonus.create({
      data: {
        employeeId,
        amount: body.amount,
        addedBy: body.addedBy ?? null,
      },
    });

    return NextResponse.json({ ok: true, bonus });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, message: err?.message || "Something went wrong" },
      { status: 400 }
    );
  }
}
