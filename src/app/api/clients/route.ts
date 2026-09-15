export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { client as clientTable, task, user as userTable, monthlyDeliverable, oneOffDeliverable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, eq, or, ilike, arrayContains, gte, lte, asc, count } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { createClientFolders } from "@/lib/s3";
import { createRecurringTasksForClient } from "@/app/api/clients/recurring";
import { redis, cached } from "@/lib/redis";
import { onboardNewClient } from "@/lib/client-onboarding";
import { getCurrentUser2 } from "@/lib/auth";
import { NextRequest } from "next/server";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// ---------- GET /api/clients ----------
export async function GET(req: NextRequest) {
  const { db, closeDb } = getDbPool();
  try {
  try {
    // If the caller is a client-role user, only return their own client record.
    // This prevents client users from seeing all clients in the dropdown.
    const caller = await getCurrentUser2(req);
    if (caller?.role === "client") {
      let linkedClientId = caller.linkedClientId ?? null;
      if (!linkedClientId) {
        const [found] = await db.select({ id: clientTable.id }).from(clientTable)
          .where(or(eq(clientTable.email, caller.email), arrayContains(clientTable.emails, [caller.email])))
          .limit(1);
        linkedClientId = found?.id ?? null;
      }

      if (!linkedClientId) {
        return NextResponse.json({ clients: [] });
      }

      const [foundClient] = await db.select({ id: clientTable.id, name: clientTable.name, companyName: clientTable.companyName })
        .from(clientTable).where(eq(clientTable.id, linkedClientId)).limit(1);

      if (!foundClient) return NextResponse.json({ clients: [] });

      return NextResponse.json({
        clients: [{ id: foundClient.id, name: foundClient.name, companyName: foundClient.companyName || foundClient.name }],
      });
    }

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Optimized: Fetch clients and task counts separately but concurrently
    const [rawClients, taskCounts] = await Promise.all([
      db.query.client.findMany({
        orderBy: asc(clientTable.name),
        with: {
          monthlyDeliverables: true,
          oneOffDeliverables: true,
          brandAssets: true,
          recurringTasks: true,
          clientPortalAccesses: {
            columns: {
              status: true,
              nextBillingDate: true,
              lockedAt: true,
              adminUnlockedAt: true,
            },
          },
        },
      }),
      db.select({ clientId: task.clientId, status: task.status, value: count() })
        .from(task)
        .where(and(gte(task.createdAt, startOfMonth.toISOString()), lte(task.createdAt, endOfMonth.toISOString())))
        .groupBy(task.clientId, task.status)
    ]);

    const clients = rawClients.map(({ clientPortalAccesses, ...c }: any) => ({
      ...c,
      portalAccess: clientPortalAccesses?.[0] ?? null,
    }));

    // Map task counts for easy lookup
    const statsMap = new Map<string, { total: number; completed: number }>();
    taskCounts.forEach((stat) => {
      const clientId = stat.clientId;
      if (!clientId) return;

      const current = statsMap.get(clientId) || { total: 0, completed: 0 };
      const statCount = stat.value;
      current.total += statCount;
      if (stat.status === "COMPLETED" || stat.status === "SCHEDULED") {
        current.completed += statCount;
      }
      statsMap.set(clientId, current);
    });

    const formattedClients = clients.map((c) => {
      const stats = statsMap.get(c.id) || { total: 0, completed: 0 };
      const totalMonthlyDeliverables = (c.monthlyDeliverables || []).reduce(
        (sum: number, d: any) => sum + (d.quantity || 0),
        0
      );

      return {
        ...c,
        emails: c.emails ?? [],
        phones: c.phones ?? [],
        monthlyDeliverables: c.monthlyDeliverables ?? [],
        oneOffDeliverables: c.oneOffDeliverables ?? [],
        brandAssets: c.brandAssets ?? [],
        recurringTasks: c.recurringTasks ?? [],
        brandGuidelines: (c.brandGuidelines as any) ?? {
          primaryColors: [],
          secondaryColors: [],
          fonts: [],
          logoUsage: "",
          toneOfVoice: "",
          brandValues: "",
          targetAudience: "",
          contentStyle: "",
        },
        projectSettings: (c.projectSettings as any) ?? {
          defaultVideoLength: "60 seconds",
          preferredPlatforms: [],
          contentApprovalRequired: false,
          quickTurnaroundAvailable: false,
        },
        billing: (c.billing as any) ?? {
          monthlyFee: "",
          billingFrequency: "monthly",
          billingDay: 1,
          paymentMethod: "credit-card",
          nextBillingDate: "",
          notes: "",
        },
        postingSchedule: (c.postingSchedule as any) ?? {},
        // 🔥 Dynamic progress calculation
        currentProgress: {
          completed: stats.completed,
          total: totalMonthlyDeliverables || stats.total,
        },
        // Remove tasks from response to keep it clean
        tasks: undefined,
      };
    });

    return NextResponse.json({ clients: formattedClients });
  } catch (err) {
    console.error("GET /clients error:", err);
    return NextResponse.json(
      { message: "Failed to load clients" },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}

// ---------- POST /api/clients ----------
export async function POST(req: Request) {
  const { db, closeDb } = getDbPool();
  try {
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
    let coverImage = false;

    const body = await req.json();

    const {
      name,
      email,
      emails,
      phone,
      phones,
      companyName,
      address,
      accountManagerId,
      monthlyDeliverables,
      oneOffDeliverables,
      brandGuidelines,
      projectSettings,
      billing,
      postingSchedule,
      clientReviewRequired,
      clientReviewDeliverableTypes,
      videographerRequired,
      coverImageRequired,
      hasPostingServices,
      templateHashtags,
      sendWelcomeEmail,
      sendMagicLink,
      shootDaysPerMonth,
      scriptsRequired,
    } = body;

    if (!name || !email)
      return NextResponse.json(
        { message: "Name and email required" },
        { status: 400 }
      );

    if (clientReviewRequired == "yes") {
      clientReview = true;
    }

    if (videographerRequired == "yes") {
      videographer = true;
    }

    if (coverImageRequired == "yes") {
      coverImage = true;
    }

    const additionalEmails = (emails || []).filter((e: string) => e.trim() !== "");
    const additionalPhones = (phones || []).filter((p: string) => p.trim() !== "");

    const folders = await createClientFolders(companyName);

    const { user, client, createdDeliverables, createdOneOffs } = await db.transaction(async (tx) => {
      const [user] = await tx.insert(userTable).values({
        name,
        email,
        password: null,
        role: "client",
        updatedAt: new Date().toISOString(),
      }).returning();

      const [client] = await tx.insert(clientTable).values({
        id: createId(),
        name,
        email,
        emails: additionalEmails,
        companyName: companyName || null,
        address: address || null,
        phone,
        phones: additionalPhones,
        createdBy: decoded.userId.toString(),
        userId: user.id,
        accountManagerId,
        status: "active",
        startDate: new Date().toISOString(),
        renewalDate: null,
        lastActivity: new Date().toISOString(),
        driveFolderId: folders.mainFolderId,
        rawFootageFolderId: folders.rawFolderId,
        essentialsFolderId: folders.elementsFolderId,
        outputsFolderId: folders.outputsFolderId,
        brandGuidelines,
        projectSettings,
        billing,
        postingSchedule,
        requiresClientReview: clientReview,
        clientReviewDeliverableTypes: clientReviewDeliverableTypes ?? [],
        requiresVideographer: videographer,
        requiresCoverImage: coverImage,
        hasPostingServices: hasPostingServices ?? true,
        templateHashtags: (templateHashtags || []).filter((t: string) => t.trim() !== ""),
        currentProgress: { completed: 0, total: 0 },
        shootDaysPerMonth: Math.max(0, Math.min(99, Number(shootDaysPerMonth) || 0)),
        scriptsRequired: !!scriptsRequired,
        updatedAt: new Date().toISOString(),
      }).returning();

      const createdDeliverables = await Promise.all(
        (monthlyDeliverables || []).map((d: any) =>
          tx.insert(monthlyDeliverable).values({
            id: createId(),
            clientId: client.id,
            type: d.type,
            quantity: d.quantity,
            videosPerDay: d.videosPerDay,
            postingSchedule: d.postingSchedule,
            postingDays: d.postingDays,
            postingTimes: d.postingTimes,
            platforms: d.platforms,
            description: d.description,
            isTrial: d.isTrial ?? false,
            updatedAt: new Date().toISOString(),
          }).returning().then((rows) => rows[0])
        )
      );

      const createdOneOffs = await Promise.all(
        (oneOffDeliverables || []).map((d: any) =>
          tx.insert(oneOffDeliverable).values({
            id: createId(),
            clientId: client.id,
            type: d.type,
            quantity: d.quantity,
            videosPerDay: d.videosPerDay,
            postingSchedule: "one-off",
            postingDays: d.postingDays,
            postingTimes: d.postingTimes,
            platforms: d.platforms,
            description: d.description,
            status: "PENDING",
            updatedAt: new Date().toISOString(),
          }).returning().then((rows) => rows[0])
        )
      );

      await createRecurringTasksForClient(client.id, tx);

      return { user, client, createdDeliverables, createdOneOffs };
    });

    // 🔥 Invalidate clients cache
    await redis.del("clients:all");

    // 🎉 Onboarding: Slack channel always created; at most one of
    // welcome-email / magic-link fires, per the two checkboxes in
    // QuickAddClientDialog (non-blocking — client creation doesn't wait on
    // it). Mutual-exclusivity is enforced inside onboardNewClient itself,
    // so raw flags are passed through as-is.
    onboardNewClient({
      clientId: client.id,
      clientName: name,
      companyName: companyName || name,
      email,
      sendWelcomeEmail: !!sendWelcomeEmail,
      sendMagicLink: !!sendMagicLink,
    }).catch(err => console.error('[POST /clients] Onboarding error:', err));

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

  } finally {
    await closeDb();
  }
}