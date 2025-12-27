import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get all clients with userId
    const clients = await prisma.client.findMany({
      where: { userId: { not: null } },
      select: { id: true, userId: true, name: true },
    });

    console.log(`Found ${clients.length} clients with userId`);

    let totalUpdated = 0;

    for (const client of clients) {
      const updated = await prisma.task.updateMany({
        where: {
          clientId: client.id,
          clientUserId: null,
        },
        data: {
          clientUserId: client.userId,
        },
      });

      console.log(`Updated ${updated.count} tasks for client ${client.name}`);
      totalUpdated += updated.count;
    }

    return NextResponse.json({ 
      success: true,
      message: "Backfill complete!",
      clientsProcessed: clients.length,
      tasksUpdated: totalUpdated,
    });
  } catch (error: any) {
    console.error("❌ Error:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}