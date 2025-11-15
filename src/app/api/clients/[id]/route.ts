import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const client = await prisma.client.findUnique({
      where: { id: id },
      include: {
        monthlyDeliverables: true,
        brandAssets: true,
        recurringTasks: true,
      }
    });

    if (!client) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch (err) {
    console.error("GET /clients/:id error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = await req.json();

    const updated = await prisma.client.update({
      where: { id: id},
      data: {
        name: data.name,
        email: data.email,
        companyName: data.companyName,
        phone: data.phone,
        status: data.status,
        accountManagerId: data.accountManagerId,

        brandGuidelines: data.brandGuidelines,
        projectSettings: data.projectSettings,
        billing: data.billing,
        postingSchedule: data.postingSchedule,
      }
    });

    return NextResponse.json({ success: true, updated });
  } catch (err) {
    console.error("PUT client failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    // STEP 1 — Delete Recurring Tasks tied to deliverables
    await prisma.recurringTask.deleteMany({
      where: { clientId: id },
    });

    // STEP 2 — Delete Monthly Deliverables
    await prisma.monthlyDeliverable.deleteMany({
      where: { clientId: id },
    });

    // STEP 3 — Delete Brand Assets
    await prisma.brandAsset.deleteMany({
      where: { clientId: id },
    });

    // STEP 4 — Delete Tasks linked to client
    await prisma.task.deleteMany({
      where: { clientId: id },
    });

    // STEP 5 — Finally delete the client
    await prisma.client.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE client failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}


