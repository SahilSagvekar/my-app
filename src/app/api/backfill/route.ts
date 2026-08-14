export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { client as clientTable, task as taskTable } from "@/lib/db/schema";
import { and, eq, isNull, isNotNull } from "drizzle-orm";

export async function GET() {
  const { db, closeDb } = getDb();
  try {
  try {
    // Get all clients with userId
    const clients = await db.select({ id: clientTable.id, userId: clientTable.userId, name: clientTable.name })
      .from(clientTable)
      .where(isNotNull(clientTable.userId));

    console.log(`Found ${clients.length} clients with userId`);

    let totalUpdated = 0;

    for (const client of clients) {
      const updatedRows = await db.update(taskTable)
        .set({ clientUserId: client.userId, updatedAt: new Date().toISOString() })
        .where(and(eq(taskTable.clientId, client.id), isNull(taskTable.clientUserId)))
        .returning({ id: taskTable.id });

      console.log(`Updated ${updatedRows.length} tasks for client ${client.name}`);
      totalUpdated += updatedRows.length;
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

  } finally {
    await closeDb();
  }
}