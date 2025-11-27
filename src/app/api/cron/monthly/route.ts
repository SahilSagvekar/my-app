import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runMonthlyRecurringForClient } from "@/lib/recurring/runMonthly";

export async function GET() {
  const clients = await prisma.client.findMany();

  let processed = 0;
  let generated = 0;

  for (const client of clients) {
    const result = await runMonthlyRecurringForClient(client.id);

    processed++;

    // Only count if it created tasks
    if (!result.alreadyRan) {
      generated += result.created ?? 0;
    }
  }

  return NextResponse.json({
    processed,
    generated
  });
}
