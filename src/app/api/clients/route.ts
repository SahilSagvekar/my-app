import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { createClientFolders } from "@/lib/s3";
import { createRecurringTasksForClient } from "@/app/api/clients/recurring";

// Helper to extract JWT from cookies
function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// ---------- GET /api/clients ----------
export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
      include: {
        monthlyDeliverables: true,
        brandAssets: true,
        recurringTasks: true,
      },
    });

    const normalized = clients.map((c) => ({
      ...c,

      // Include emails and phones arrays
      emails: c.emails ?? [],
      phones: c.phones ?? [],

      monthlyDeliverables: c.monthlyDeliverables ?? [],
      brandAssets: c.brandAssets ?? [],
      recurringTasks: c.recurringTasks ?? [],

      brandGuidelines: c.brandGuidelines ?? {
        primaryColors: [],
        secondaryColors: [],
        fonts: [],
        logoUsage: "",
        toneOfVoice: "",
        brandValues: "",
        targetAudience: "",
        contentStyle: "",
      },

      projectSettings: c.projectSettings ?? {
        defaultVideoLength: "60 seconds",
        preferredPlatforms: [],
        contentApprovalRequired: false,
        quickTurnaroundAvailable: false,
      },

      billing: c.billing ?? {
        monthlyFee: "",
        billingFrequency: "monthly",
        billingDay: 1,
        paymentMethod: "credit-card",
        nextBillingDate: "",
        notes: "",
      },

      postingSchedule: c.postingSchedule ?? {},

      currentProgress: c.currentProgress ?? { completed: 0, total: 0 },
    }));

    return NextResponse.json({ clients: normalized });

  } catch (err) {
    console.error("GET /clients error:", err);
    return NextResponse.json(
      { message: "Failed to load clients" },
      { status: 500 }
    );
  }
}

// ---------- POST /api/clients ----------
export async function POST(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!["admin", "manager"].includes(decoded.role))
      return NextResponse.json(
        { message: "Permission denied" },
        { status: 403 }
      );

    let clientReview = false;
    let videographer = false;

    const body = await req.json();
    const {
      name,
      email,
      emails, // NEW: Additional emails
      phone,
      phones, // NEW: Additional phones
      company,
      accountManagerId,

      // Big UI chunks
      monthlyDeliverables,
      brandGuidelines,
      projectSettings,
      billing,
      postingSchedule,
      requiresClientReview,
      requiresVideographer,
    } = body;

    if (!name || !email)
      return NextResponse.json(
        { message: "Name and email required" },
        { status: 400 }
      );

    if (requiresClientReview == "yes") {
      clientReview = true;
    }

    if (requiresVideographer == "yes") {
      videographer = true;
    }

    // Filter out empty emails and phones
    const additionalEmails = (emails || []).filter((e: string) => e.trim() !== "");
    const additionalPhones = (phones || []).filter((p: string) => p.trim() !== "");

    // STEP 1 — Create Drive Folders
    const folders = await createClientFolders(name);

    // STEP 2 — Create User
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: email,
        role: "client",
      }
    });

    // STEP 3 — Create Client
    const client = await prisma.client.create({
      data: {
        name,
        email,
        emails: additionalEmails, // NEW: Store additional emails
        companyName: company || null,
        phone,
        phones: additionalPhones, // NEW: Store additional phones
        createdBy: decoded.userId.toString(),

        user: {
          connect: { id: user.id },
        },

        accountManagerId,
        status: "active",
        startDate: new Date(),
        renewalDate: null,
        lastActivity: new Date(),

        driveFolderId: folders.mainFolderId,
        rawFootageFolderId: folders.rawFolderId,
        essentialsFolderId: folders.essentialsFolderId,

        brandGuidelines,
        projectSettings,
        billing,
        postingSchedule,

        requiresClientReview: clientReview,
        requiresVideographer: videographer,

        currentProgress: { completed: 0, total: 0 },
      },
    });

    // STEP 4 — Insert deliverables into SQL
    const createdDeliverables = await Promise.all(
      (monthlyDeliverables || []).map((d: any) =>
        prisma.monthlyDeliverable.create({
          data: {
            clientId: client.id,
            type: d.type,
            quantity: d.quantity,
            videosPerDay: d.videosPerDay,
            postingSchedule: d.postingSchedule,
            postingDays: d.postingDays,
            postingTimes: d.postingTimes,
            platforms: d.platforms,
            description: d.description,
          },
        })
      )
    );

    // STEP 5 — Create RecurringTask entries
    await createRecurringTasksForClient(client.id);

    return NextResponse.json(
      {
        success: true,
        client: {
          ...client,
          emails: additionalEmails,
          phones: additionalPhones,
        },
        deliverables: createdDeliverables,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("❌ POST /clients error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}