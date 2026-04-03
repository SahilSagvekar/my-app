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

    return NextResponse.json({
      clients,
      deliverableTypes: uniqueTypes,
    });
  } catch (err: any) {
    console.error("GET /api/schedular/metadata error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
