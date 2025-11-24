import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { createClientFolders } from "@/lib/googleDrive";
import { createRecurringTasksForClient } from "@/app/api/clients/recurring";

// Helper to extract JWT from cookies
function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  // You were using authToken here; keep it consistent
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// ---------- GET /api/clients ----------
// Returns full structured list tailored for your ClientManagement UI
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

      monthlyDeliverables: c.monthlyDeliverables ?? [],
      brandAssets: c.brandAssets ?? [],
      recurringTasks: c.recurringTasks ?? [],

      // JSON defaults
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
// Accepts full client payload from your Add Client dialog
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

    const body = await req.json();
    const {
      name,
      email,
      company,
      phone,
      accountManagerId,

      // Big UI chunks
      monthlyDeliverables,
      brandGuidelines,
      projectSettings,
      billing,
      postingSchedule,
    } = body;

    if (!name || !email)
      return NextResponse.json(
        { message: "Name and email required" },
        { status: 400 }
      );

    // STEP 1 — Create Drive Folders
    const folders = await createClientFolders(name);

    // STEP 2 — Create Client

    const user = await prisma.user.create({
      data: {
        email,
        password: email,
        role: "client",
      }
    })

    const client = await prisma.client.create({
      data: {
        name,
        email,
        companyName: company || null,
        phone,
        createdBy: decoded.userId.toString(),

        accountManagerId,
        status: "active",
        startDate: new Date(),
        renewalDate: null,
        lastActivity: new Date(),

        driveFolderId: folders.mainFolderId,
        rawFootageFolderId: folders.rawFolderId,
        essentialsFolderId: folders.essentialsFolderId,

        monthlyDeliverables: undefined, // Don't store raw JSON here
        brandAssets: undefined,

        brandGuidelines,
        projectSettings,
        billing,
        postingSchedule,

        currentProgress: { completed: 0, total: 0 },
      },
    });

    // STEP 3 — Insert deliverables into SQL
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

    // STEP 4 — Create RecurringTask entries
    await createRecurringTasksForClient(client.id);

    return NextResponse.json(
      {
        success: true,
        client,
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
