import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { createClientFolders } from "@/lib/googleDrive";

// ✅ Helper to extract token from cookies
function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// ✅ GET — Return full structured list for UI
// export async function GET() {
//   try {
//     const clients = await prisma.client.findMany({
//       orderBy: { name: "asc" },
//       select: {
//         id: true,
//         name: true,
//         email: true,
//         companyName: true,
//         phone: true,
//         driveFolderId: true,
//         rawFootageFolderId: true,
//         essentialsFolderId: true,
//         longFormVideos: true,
//         shortFormClips: true,
//         socialPosts: true,
//         customDeliverables: true,
//         createdAt: true,
//       },
//     });

//     // ✅ Normalize shape for frontend expectations
//     const normalized = clients.map((c) => ({
//   ...c,
//   monthlyDeliverables: {
//     longFormVideos: c.longFormVideos ?? 0,
//     shortFormClips: c.shortFormClips ?? 0,
//     socialPosts: c.socialPosts ?? 0,
//     customDeliverables: c.customDeliverables ?? "",
//   },
//   // ✅ Safe defaults
//   currentProgress: {
//     completed: 0,
//     total: 0,
//   },
//   lastActivity: c.createdAt,
//   brandAssets: [], // 👈 ensures .length always exists
//   brandGuidelines: {
//     primaryColors: [],
//     secondaryColors: [],
//     fonts: [],
//     logoUsage: "",
//     toneOfVoice: "",
//     brandValues: "",
//     targetAudience: "",
//     contentStyle: "",
//   },
//   projectSettings: {
//     defaultVideoLength: "60 seconds",
//     preferredPlatforms: [],
//     contentApprovalRequired: false,
//     quickTurnaroundAvailable: false,
//   },
// }));


//     console.log("✅ Clients fetched:", normalized.length);
//     return NextResponse.json({ clients: normalized });
//   } catch (error) {
//     console.error("❌ Error fetching clients:", error);
//     return NextResponse.json(
//       { success: false, message: "Failed to fetch clients" },
//       { status: 500 }
//     );
//   }
// }

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
    });

    // 🧠 Normalize to ensure frontend never breaks
    const normalized = clients.map((c) => ({
      ...c,
      monthlyDeliverables: {
        longFormVideos: c.longFormVideos ?? 0,
        shortFormClips: c.shortFormClips ?? 0,
        socialPosts: c.socialPosts ?? 0,
        customDeliverables: c.customDeliverables ?? "",
      },
      currentProgress: {
        completed: c.completedTasks ?? 0,
        total: c.totalTasks ?? 0,
      },
      brandAssets: c.brandAssets ?? [],
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
    }));

    return NextResponse.json({ clients: normalized });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}


// ✅ POST — Create new client with Drive folders
export async function POST(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    if (!["admin", "manager"].includes(role?.toLowerCase())) {
      return NextResponse.json(
        { message: "Only admins or managers can add clients" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      email,
      companyName,
      phone,
      longFormVideos,
      shortFormClips,
      socialPosts,
      customDeliverables,
    } = body || {};

    if (!name || !email) {
      return NextResponse.json(
        { message: "Client name and email are required" },
        { status: 400 }
      );
    }

    // 🧠 Create Google Drive folders
    const driveFolders = await createClientFolders(name);

    // 🧩 Save client to DB
    const newClient = await prisma.client.create({
      data: {
        name,
        email,
        companyName: companyName || null,
        phone: phone || null,
        createdBy: String(userId), // ✅ Fix: ensure type matches Prisma schema

        driveFolderId: driveFolders.mainFolderId,
        rawFootageFolderId: driveFolders.rawFolderId,
        essentialsFolderId: driveFolders.essentialsFolderId,

        longFormVideos: Number(longFormVideos) || 0,
        shortFormClips: Number(shortFormClips) || 0,
        socialPosts: Number(socialPosts) || 0,
        customDeliverables: customDeliverables || "",
      },
    });

    // ✅ Return the created client in the same format the UI expects
    const clientResponse = {
      ...newClient,
      monthlyDeliverables: {
        longFormVideos: newClient.longFormVideos,
        shortFormClips: newClient.shortFormClips,
        socialPosts: newClient.socialPosts,
        customDeliverables: newClient.customDeliverables,
      },
    };

    return NextResponse.json({ client: clientResponse }, { status: 201 });
  } catch (err: any) {
    console.error("❌ Create client error:", err);

    if (err.code === "P2002") {
      return NextResponse.json(
        { message: "A client with this email already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { message: "Server error", error: err.message || String(err) },
      { status: 500 }
    );
  }
}
