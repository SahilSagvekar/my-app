export const dynamic = 'force-dynamic';
// import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import jwt from "jsonwebtoken";
// import { createClientFolders } from "@/lib/s3";
// import { createRecurringTasksForClient } from "@/app/api/clients/recurring";
// import { redis, cached } from "@/lib/redis";

// function getTokenFromCookies(req: Request) {
//   const cookieHeader = req.headers.get("cookie");
//   if (!cookieHeader) return null;
//   const match = cookieHeader.match(/authToken=([^;]+)/);
//   return match ? match[1] : null;
// }

// // ---------- GET /api/clients ----------
// export async function GET() {
//   try {
//     const clients = await cached(
//       "clients:all",
//       async () => {
//         const clients = await prisma.client.findMany({
//           orderBy: { name: "asc" },
//           include: {
//             monthlyDeliverables: true,
//             brandAssets: true,
//             recurringTasks: true,
//           },
//         });

//         return clients.map((c) => ({
//           ...c,
//           emails: c.emails ?? [],
//           phones: c.phones ?? [],
//           monthlyDeliverables: c.monthlyDeliverables ?? [],
//           brandAssets: c.brandAssets ?? [],
//           recurringTasks: c.recurringTasks ?? [],
//           brandGuidelines: c.brandGuidelines ?? {
//             primaryColors: [],
//             secondaryColors: [],
//             fonts: [],
//             logoUsage: "",
//             toneOfVoice: "",
//             brandValues: "",
//             targetAudience: "",
//             contentStyle: "",
//           },
//           projectSettings: c.projectSettings ?? {
//             defaultVideoLength: "60 seconds",
//             preferredPlatforms: [],
//             contentApprovalRequired: false,
//             quickTurnaroundAvailable: false,
//           },
//           billing: c.billing ?? {
//             monthlyFee: "",
//             billingFrequency: "monthly",
//             billingDay: 1,
//             paymentMethod: "credit-card",
//             nextBillingDate: "",
//             notes: "",
//           },
//           postingSchedule: c.postingSchedule ?? {},
//           currentProgress: c.currentProgress ?? { completed: 0, total: 0 },
//         }));
//       },
//       600 // 10 minutes
//     );

//     return NextResponse.json({ clients });
//   } catch (err) {
//     console.error("GET /clients error:", err);
//     return NextResponse.json(
//       { message: "Failed to load clients" },
//       { status: 500 }
//     );
//   }
// }

// // ---------- POST /api/clients ----------
// export async function POST(req: Request) {
//   try {
//     const token = getTokenFromCookies(req);
//     if (!token)
//       return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

//     const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
//     if (!["admin", "manager"].includes(decoded.role))
//       return NextResponse.json(
//         { message: "Permission denied" },
//         { status: 403 }
//       );

//     let clientReview = false;
//     let videographer = false;

//     const body = await req.json();

//     const {
//       name,
//       email,
//       emails,
//       phone,
//       phones,
//       companyName,
//       accountManagerId,
//       monthlyDeliverables,
//       brandGuidelines,
//       projectSettings,
//       billing,
//       postingSchedule,
//       clientReviewRequired,
//       videographerRequired,
//     } = body;

//     if (!name || !email)
//       return NextResponse.json(
//         { message: "Name and email required" },
//         { status: 400 }
//       );

//     if (clientReviewRequired == "yes") {
//       clientReview = true;
//     }

//     if (videographerRequired == "yes") {
//       videographer = true;
//     }

//     const additionalEmails = (emails || []).filter((e: string) => e.trim() !== "");
//     const additionalPhones = (phones || []).filter((p: string) => p.trim() !== "");

//     const folders = await createClientFolders(companyName);

//     const user = await prisma.user.create({
//       data: {
//         name,
//         email,
//         password: null,
//         role: "client",
//       }
//     });

//     const client = await prisma.client.create({
//       data: {
//         name,
//         email,
//         emails: additionalEmails,
//         companyName: companyName || null,
//         phone,
//         phones: additionalPhones,
//         createdBy: decoded.userId.toString(),
//         user: {
//           connect: { id: user.id },
//         },
//         accountManagerId,
//         status: "active",
//         startDate: new Date(),
//         renewalDate: null,
//         lastActivity: new Date(),
//         driveFolderId: folders.mainFolderId,
//         rawFootageFolderId: folders.rawFolderId,
//         essentialsFolderId: folders.essentialsFolderId,
//         outputsFolderId: folders.outputsFolderId,
//         brandGuidelines,
//         projectSettings,
//         billing,
//         postingSchedule,
//         requiresClientReview: clientReview,
//         requiresVideographer: videographer,
//         currentProgress: { completed: 0, total: 0 },
//       },
//     });

//     const createdDeliverables = await Promise.all(
//       (monthlyDeliverables || []).map((d: any) =>
//         prisma.monthlyDeliverable.create({
//           data: {
//             clientId: client.id,
//             type: d.type,
//             quantity: d.quantity,
//             videosPerDay: d.videosPerDay,
//             postingSchedule: d.postingSchedule,
//             postingDays: d.postingDays,
//             postingTimes: d.postingTimes,
//             platforms: d.platforms,
//             description: d.description,
//           },
//         })
//       )
//     );

//     await createRecurringTasksForClient(client.id);

//     // 🔥 Invalidate clients cache
//     await redis.del("clients:all");

//     return NextResponse.json(
//       {
//         success: true,
//         client: {
//           ...client,
//           emails: additionalEmails,
//           phones: additionalPhones,
//         },
//         deliverables: createdDeliverables,
//       },
//       { status: 201 }
//     );
//   } catch (err: any) {
//     console.error("❌ POST /clients error:", err);
//     return NextResponse.json(
//       { success: false, message: err.message },
//       { status: 500 }
//     );
//   }
// }

// export async function GET(request: Request) {
//   try {
//     const clients = await prisma.client.findMany({
//       select: {
//         id: true,
//         companyName: true,
//       },
//       orderBy: {
//         companyName: "asc",
//       },
//     });

//     return NextResponse.json(clients);
//   } catch (error) {
//     return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
//   }
// }




import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { createClientFolders } from "@/lib/s3";
import { createRecurringTasksForClient } from "@/app/api/clients/recurring";
import { redis, cached } from "@/lib/redis";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// ---------- GET /api/clients ----------
export async function GET() {
  try {
    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Optimized: Fetch clients and task counts separately but concurrently
    const [clients, taskCounts] = await Promise.all([
      prisma.client.findMany({
        orderBy: { name: "asc" },
        include: {
          monthlyDeliverables: true,
          oneOffDeliverables: true,
          brandAssets: true,
          recurringTasks: true,
        },
      }),
      prisma.task.groupBy({
        by: ['clientId', 'status'],
        where: {
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
        _count: { id: true },
      })
    ]);

    // Map task counts for easy lookup
    const statsMap = new Map<string, { total: number; completed: number }>();
    taskCounts.forEach((stat) => {
      const clientId = stat.clientId;
      if (!clientId) return;
      
      const current = statsMap.get(clientId) || { total: 0, completed: 0 };
      const count = stat._count.id;
      current.total += count;
      if (stat.status === "COMPLETED" || stat.status === "SCHEDULED") {
        current.completed += count;
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
      emails,
      phone,
      phones,
      companyName,
      accountManagerId,
      monthlyDeliverables,
      oneOffDeliverables,
      brandGuidelines,
      projectSettings,
      billing,
      postingSchedule,
      clientReviewRequired,
      videographerRequired,
      hasPostingServices,
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

    const additionalEmails = (emails || []).filter((e: string) => e.trim() !== "");
    const additionalPhones = (phones || []).filter((p: string) => p.trim() !== "");

    const folders = await createClientFolders(companyName);

    const { user, client, createdDeliverables, createdOneOffs } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: null,
          role: "client",
        }
      });

      const client = await tx.client.create({
        data: {
          name,
          email,
          emails: additionalEmails,
          companyName: companyName || null,
          phone,
          phones: additionalPhones,
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
          essentialsFolderId: folders.elementsFolderId,
          outputsFolderId: folders.outputsFolderId,
          brandGuidelines,
          projectSettings,
          billing,
          postingSchedule,
          requiresClientReview: clientReview,
          requiresVideographer: videographer,
          hasPostingServices: hasPostingServices ?? true,
          currentProgress: { completed: 0, total: 0 },
        },
      });

      const createdDeliverables = await Promise.all(
        (monthlyDeliverables || []).map((d: any) =>
          tx.monthlyDeliverable.create({
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
              isTrial: d.isTrial ?? false,
            },
          })
        )
      );

      const createdOneOffs = await Promise.all(
        (oneOffDeliverables || []).map((d: any) =>
          tx.oneOffDeliverable.create({
            data: {
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
            },
          })
        )
      );

      await createRecurringTasksForClient(client.id, tx);

      return { user, client, createdDeliverables, createdOneOffs };
    });

    // 🔥 Invalidate clients cache
    await redis.del("clients:all");

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