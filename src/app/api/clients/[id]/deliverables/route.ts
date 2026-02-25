// app/api/clients/[clientId]/deliverables/route.ts
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Helper: safely extract clientId from URL and params
function getClientId(req: Request, paramsObj: { id?: string } = {}): string | null {
  if (paramsObj.id) return paramsObj.id;
  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const clientsIndex = segments.indexOf("clients");
    if (clientsIndex !== -1 && segments[clientsIndex + 1]) {
      return segments[clientsIndex + 1];
    }
  } catch {
    // ignore
  }
  return null;
}

// POST - Create a new deliverable for a client
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = getClientId(req, params);

    console.log("➕ Creating deliverable for client:", clientId);
    const data = await req.json();

    console.log("📦 Deliverable data:", data);

    if (!clientId) {
      return NextResponse.json({ message: "Client ID missing in request URL" }, { status: 400 });
    }
    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    const deliverable = await prisma.monthlyDeliverable.create({
      data: {
        clientId,
        type: data.type,
        quantity: data.quantity || 1,
        videosPerDay: data.videosPerDay || 1,
        postingSchedule: data.postingSchedule || "weekly",
        postingDays: data.postingDays || [],
        postingTimes: data.postingTimes || ["10:00"],
        platforms: data.platforms || [],
        description: data.description || "",
      },
    });

    console.log("✅ Deliverable created:", deliverable.id);

    return NextResponse.json({
      success: true,
      deliverable
    }, { status: 201 });

  } catch (err) {
    console.error("POST deliverable failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

// GET - Get all deliverables for a client
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = getClientId(req, params);

    if (!clientId) {
      return NextResponse.json({ message: "Client ID missing in request URL" }, { status: 400 });
    }

    const deliverables = await prisma.monthlyDeliverable.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ deliverables, monthlyDeliverables: deliverables });

  } catch (err) {
    console.error("GET deliverables failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}