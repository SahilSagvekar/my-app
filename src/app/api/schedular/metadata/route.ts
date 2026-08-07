import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch all unique clients that have tasks in completed/scheduled status
    const clients = await prisma.client.findMany({
      select: {
        id: true,
        name: true,
        companyName: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 2. Fetch all unique deliverable types across both tables
    const [monthlyTypes, oneOffTypes] = await Promise.all([
      prisma.monthlyDeliverable.findMany({
        distinct: ['type'],
        select: { type: true },
      }),
      prisma.oneOffDeliverable.findMany({
        distinct: ['type'],
        select: { type: true },
      }),
    ]);

    const uniqueTypes = Array.from(new Set([
      ...monthlyTypes.map(d => d.type),
      ...oneOffTypes.map(d => d.type),
    ])).filter(Boolean).sort();

    // 3. Editors — anyone whose primary role or additional roles[] includes
    // "editor", so multi-role accounts (e.g. Daena: editor + scheduler + qc)
    // show up here too, not just single-role editors.
    const editors = await prisma.user.findMany({
      where: {
        employeeStatus: 'ACTIVE',
        OR: [
          { role: 'editor' },
          { roles: { has: 'editor' } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      clients,
      deliverableTypes: uniqueTypes,
      editors,
    });
  } catch (err: any) {
    console.error("GET /api/schedular/metadata error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}