import { NextResponse } from "next/server";
import { runMonthlyRecurringForClient } from "@/lib/recurring/runMonthly";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const clientId = params.id;

  if (!clientId) {
    return NextResponse.json({ error: "Missing client ID" }, { status: 400 });
  }

  const result = await runMonthlyRecurringForClient(clientId);

  return NextResponse.json(result);
}
