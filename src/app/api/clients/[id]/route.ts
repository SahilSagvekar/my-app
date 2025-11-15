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

    const {
      name,
      email,
      companyName,
      phone,
      status,
      accountManagerId,
      brandGuidelines,
      projectSettings,
      billing,
      postingSchedule,
      monthlyDeliverables = [], // array coming from UI
    } = data;

    // STEP 1 — Update main client record
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        name,
        email,
        companyName,
        phone,
        status,
        accountManagerId,
        brandGuidelines,
        projectSettings,
        billing,
        postingSchedule,
      },
    });

    // STEP 2 — Fetch existing deliverables for this client
    const existing = await prisma.monthlyDeliverable.findMany({
      where: { clientId: id },
    });

    const existingIds = existing.map((d) => d.id);
    const incomingIds = monthlyDeliverables.map((d: any) => d.id).filter(Boolean);

    // STEP 3 — DELETE deliverables removed in UI
    const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
    if (toDelete.length > 0) {
      await prisma.monthlyDeliverable.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // STEP 4 — UPSERT remaining deliverables
    for (const d of monthlyDeliverables) {
      if (d.id && existingIds.includes(d.id)) {
        // UPDATE existing deliverable
        await prisma.monthlyDeliverable.update({
          where: { id: d.id },
          data: {
            type: d.type,
            quantity: d.quantity,
            videosPerDay: d.videosPerDay,
            postingSchedule: d.postingSchedule,
            postingDays: d.postingDays,
            postingTimes: d.postingTimes,
            platforms: d.platforms,
            description: d.description,
          },
        });
      } else {
        // CREATE new deliverable
        await prisma.monthlyDeliverable.create({
          data: {
            clientId: id,
            type: d.type,
            quantity: d.quantity,
            videosPerDay: d.videosPerDay,
            postingSchedule: d.postingSchedule,
            postingDays: d.postingDays,
            postingTimes: d.postingTimes,
            platforms: d.platforms,
            description: d.description,
          },
        });
      }
    }

    return NextResponse.json({ success: true, updated: updatedClient });
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


