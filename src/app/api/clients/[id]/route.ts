import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import jwt from "jsonwebtoken";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const client = await prisma.client.findUnique({
      where: { id: id },
      include: {
        monthlyDeliverables: true,
        brandAssets: true,
        recurringTasks: true,
        tasks: {
          where: {
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
          select: {
            id: true,
            status: true,
          },
        },
      }
    });

    if (!client) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    // Calculate total deliverables for the month
    const totalDeliverables = (client.monthlyDeliverables ?? []).reduce(
      (sum, d) => sum + (d.quantity ?? 0),
      0
    );

    // Count completed tasks (COMPLETED or SCHEDULED means posted/done)
    const completedTasks = (client.tasks ?? []).filter(
      (t) => t.status === "COMPLETED" || t.status === "SCHEDULED"
    ).length;

    const normalizedClient = {
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
      // 🔥 Dynamic progress calculation
      currentProgress: {
        completed: completedTasks,
        total: totalDeliverables,
      },
      // Remove tasks from response to keep it clean
      tasks: undefined,
    };

    return NextResponse.json({ client: normalizedClient });
  } catch (err) {
    console.error("GET /clients/:id error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const data = await req.json();

    console.log("📝 PUT /clients/:id - Received data:", JSON.stringify(data, null, 2));

    let clientReview = false;
    let videographer = false;

    const {
      name,
      email,
      emails,
      companyName,
      phone,
      phones,
      status,
      accountManagerId,
      brandGuidelines,
      projectSettings,
      billing,
      postingSchedule,
      clientReviewRequired,
      videographerRequired,
      monthlyDeliverables = [],
    } = data;

    if (clientReviewRequired === "yes") {
      clientReview = true;
    }

    if (videographerRequired === "yes") {
      videographer = true;
    }

    const additionalEmails = (emails || []).filter((e: string) => e.trim() !== "");
    const additionalPhones = (phones || []).filter((p: string) => p.trim() !== "");

    // Update client basic info
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        name,
        email,
        emails: additionalEmails,
        companyName,
        phone,
        phones: additionalPhones,
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

    // 🔥 Handle monthly deliverables
    console.log("📦 Processing monthlyDeliverables:", monthlyDeliverables.length, "items");

    const existing = await prisma.monthlyDeliverable.findMany({
      where: { clientId: id },
    });

    console.log("📦 Existing deliverables in DB:", existing.length, "items");

    const existingIds = existing.map((d) => d.id);

    // Filter out frontend-generated IDs (they start with "deliverable-")
    const incomingDbIds = monthlyDeliverables
      .map((d: any) => d.id)
      .filter((deliverableId: string) => deliverableId && !deliverableId.startsWith("deliverable-"));

    console.log("📦 Existing IDs:", existingIds);
    console.log("📦 Incoming DB IDs:", incomingDbIds);

    // Delete removed deliverables (ones that exist in DB but not in incoming)
    const toDelete = existingIds.filter((existingId) => !incomingDbIds.includes(existingId));
    console.log("🗑️ Deliverables to delete:", toDelete);

    if (toDelete.length > 0) {
      await prisma.recurringTask.deleteMany({
        where: { deliverableId: { in: toDelete } },
      });

      await prisma.monthlyDeliverable.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    // Update or create deliverables
    for (const d of monthlyDeliverables) {
      const isExistingDbRecord = d.id && existingIds.includes(d.id);

      if (isExistingDbRecord) {
        // UPDATE existing deliverable
        console.log("✏️ Updating deliverable:", d.id);
        await prisma.monthlyDeliverable.update({
          where: { id: d.id },
          data: {
            type: d.type,
            quantity: d.quantity,
            videosPerDay: d.videosPerDay || 1,
            postingSchedule: d.postingSchedule,
            postingDays: d.postingDays || [],
            postingTimes: d.postingTimes || [],
            platforms: d.platforms || [],
            description: d.description || "",
          },
        });
      } else {
        // CREATE new deliverable (ignore frontend-generated ID, let DB generate one)
        console.log("➕ Creating new deliverable:", d.type);
        await prisma.monthlyDeliverable.create({
          data: {
            clientId: id,
            type: d.type,
            quantity: d.quantity,
            videosPerDay: d.videosPerDay || 1,
            postingSchedule: d.postingSchedule,
            postingDays: d.postingDays || [],
            postingTimes: d.postingTimes || [],
            platforms: d.platforms || [],
            description: d.description || "",
          },
        });
      }
    }

    // 🔥 Fetch the updated client with all relations to return
    const finalClient = await prisma.client.findUnique({
      where: { id },
      include: {
        monthlyDeliverables: true,
        brandAssets: true,
        recurringTasks: true,
      },
    });

    console.log("✅ Client updated successfully with", finalClient?.monthlyDeliverables.length, "deliverables");

    // 🔥 Audit client update
    const token = req.headers.get("cookie")?.match(/authToken=([^;]+)/)?.[1];
    if (token) {
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
        await createAuditLog({
          userId: decoded.userId,
          action: AuditAction.CLIENT_UPDATED,
          entity: "Client",
          entityId: id,
          details: `Updated client: ${name || companyName}`,
          metadata: {
            clientId: id,
            updatedFields: Object.keys(data).filter(k => k !== 'monthlyDeliverables'),
            deliverableChanges: {
              added: monthlyDeliverables.filter((d: any) => !d.id || d.id.startsWith('deliverable-')).length,
              deleted: toDelete.length
            }
          }
        });
      } catch { }
    }

    return NextResponse.json({
      success: true,
      updated: {
        ...finalClient,
        emails: additionalEmails,
        phones: additionalPhones,
      }
    });
  } catch (err) {
    console.error("PUT client failed:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const tasksWithFiles = await prisma.task.findMany({
      where: { clientId: id },
      select: { id: true },
    });

    const taskIds = tasksWithFiles.map(t => t.id);

    if (taskIds.length > 0) {
      await prisma.file.deleteMany({
        where: { taskId: { in: taskIds } },
      });
    }

    await prisma.recurringTask.deleteMany({
      where: { clientId: id },
    });

    await prisma.monthlyRun.deleteMany({
      where: { clientId: id },
    });

    const deliverables = await prisma.monthlyDeliverable.findMany({
      where: { clientId: id },
      select: { id: true },
    });

    const deliverableIds = deliverables.map(d => d.id);

    if (deliverableIds.length > 0) {
      await prisma.recurringTask.deleteMany({
        where: { deliverableId: { in: deliverableIds } },
      });

      await prisma.task.deleteMany({
        where: { monthlyDeliverableId: { in: deliverableIds } },
      });

      await prisma.monthlyDeliverable.deleteMany({
        where: { id: { in: deliverableIds } },
      });
    }

    await prisma.brandAsset.deleteMany({
      where: { clientId: id },
    });

    await prisma.task.deleteMany({
      where: { clientId: id },
    });

    const deletedClient = await prisma.client.delete({
      where: { id },
    });

    // 🔥 Audit client deletion
    const token = req.headers.get("cookie")?.match(/authToken=([^;]+)/)?.[1];
    if (token) {
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
        await createAuditLog({
          userId: decoded.userId,
          action: AuditAction.CLIENT_DELETED,
          entity: "Client",
          entityId: id,
          details: `Deleted client: ${deletedClient.name || deletedClient.companyName}`,
          metadata: {
            clientId: id,
            clientName: deletedClient.name,
            companyName: deletedClient.companyName,
            tasksDeleted: taskIds.length,
            deliverablesDeleted: deliverableIds.length
          }
        });
      } catch { }
    }

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully',
      deletedClient,
    });

  } catch (error: any) {
    console.error('DELETE client failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete client',
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}