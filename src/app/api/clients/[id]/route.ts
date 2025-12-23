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

    // Normalize the response with additional contacts
    const normalized = {
      ...client,
      emails: client.emails ?? [],
      phones: client.phones ?? [],
      monthlyDeliverables: client.monthlyDeliverables ?? [],
      brandAssets: client.brandAssets ?? [],
      recurringTasks: client.recurringTasks ?? [],
      brandGuidelines: client.brandGuidelines ?? {
        primaryColors: [],
        secondaryColors: [],
        fonts: [],
        logoUsage: "",
        toneOfVoice: "",
        brandValues: "",
        targetAudience: "",
        contentStyle: "",
      },
      projectSettings: client.projectSettings ?? {
        defaultVideoLength: "60 seconds",
        preferredPlatforms: [],
        contentApprovalRequired: false,
        quickTurnaroundAvailable: false,
      },
      billing: client.billing ?? {
        monthlyFee: "",
        billingFrequency: "monthly",
        billingDay: 1,
        paymentMethod: "credit-card",
        nextBillingDate: "",
        notes: "",
      },
      postingSchedule: client.postingSchedule ?? {},
      currentProgress: client.currentProgress ?? { completed: 0, total: 0 },
    };

    return NextResponse.json({ client: normalized });
  } catch (err) {
    console.error("GET /clients/:id error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = await req.json();

    console.log("PUT:", JSON.stringify(data));

    let clientReview = false;
    let videographer = false;

    const {
      name,
      email,
      emails, // NEW: Additional emails
      companyName,
      phone,
      phones, // NEW: Additional phones
      status,
      accountManagerId,
      brandGuidelines,
      projectSettings,
      billing,
      postingSchedule,
      clientReviewRequired,
      requiresVideographer,
      monthlyDeliverables = [], // array coming from UI
    } = data;

    console.log("clientReviewRequired:", clientReviewRequired);
    console.log("requiresVideographer:", requiresVideographer);

    if (clientReviewRequired == "yes") {
      clientReview = true;
    }

    if (requiresVideographer == "yes") {
      videographer = true;
    }

    // Filter out empty emails and phones
    const additionalEmails = (emails || []).filter((e: string) => e.trim() !== "");
    const additionalPhones = (phones || []).filter((p: string) => p.trim() !== "");

    // STEP 1 — Update main client record
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        name,
        email,
        emails: additionalEmails, // NEW: Update additional emails
        companyName,
        phone,
        phones: additionalPhones, // NEW: Update additional phones
        status,
        accountManagerId,
        brandGuidelines,
        projectSettings,
        billing,
        postingSchedule,
        requiresClientReview: clientReview,
        requiresVideographer: videographer,
      },
    });

    console.log("Updated client:", updatedClient);

    // STEP 2 — Fetch existing deliverables for this client
    const existing = await prisma.monthlyDeliverable.findMany({
      where: { clientId: id },
    });

    const existingIds = existing.map((d) => d.id);
    const incomingIds = monthlyDeliverables.map((d: any) => d.id).filter(Boolean);

    // STEP 3 — DELETE deliverables removed in UI
    const toDelete = existingIds.filter((id) => !incomingIds.includes(id));
    if (toDelete.length > 0) {
      // 🔥 DELETE RELATED RECURRING TASKS FIRST
      await prisma.recurringTask.deleteMany({
        where: {
          deliverableId: { in: toDelete },
        },
      });

      // Now safe to delete the deliverables
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

    // Return normalized response
    const normalized = {
      ...updatedClient,
      emails: additionalEmails,
      phones: additionalPhones,
    };

    return NextResponse.json({ success: true, updated: normalized });
  } catch (err) {
    console.error("PUT client failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}


// export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
//   try {
//     const { id } = await context.params;

//     // STEP 1 — Delete Recurring Tasks tied to deliverables
//     await prisma.recurringTask.deleteMany({
//       where: { clientId: id },
//     });

//     // STEP 2 — Delete Monthly Deliverables
//     await prisma.monthlyDeliverable.deleteMany({
//       where: { clientId: id },
//     });

//     // STEP 3 — Delete Brand Assets
//     await prisma.brandAsset.deleteMany({
//       where: { clientId: id },
//     });

//     // STEP 4 — Delete Tasks linked to client
//     await prisma.task.deleteMany({
//       where: { clientId: id },
//     });

//     // STEP 5 — Finally delete the client
//     await prisma.client.delete({
//       where: { id },
//     });

    

//     return NextResponse.json({ success: true });
//   } catch (err) {
//     console.error("DELETE client failed:", err);
//     return NextResponse.json({ message: "Server error" }, { status: 500 });
//   }
// }


export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // STEP 0 — Fetch the client to get its linked userId
    const client = await prisma.client.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!client) {
      return NextResponse.json(
        { success: false, message: "Client not found" },
        { status: 404 }
      );
    }

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

    // STEP 5 — Delete the client record (emails and phones will be deleted automatically)
    await prisma.client.delete({
      where: { id },
    });

    // STEP 6 — Delete associated USER account
    if (client.userId) {
      await prisma.user.delete({
        where: { id: client.userId },
      });
    }

    return NextResponse.json({ success: true, message: "Client deleted successfully" });
  } catch (err) {
    console.error("DELETE client failed:", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}


