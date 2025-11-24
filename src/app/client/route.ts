import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import jwt from "jsonwebtoken";
import { createClientFolders } from "@/lib/googleDrive";

// Extract JWT from cookies
function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(req: Request) {
  try {
    const token = getTokenFromCookies(req);
    if (!token)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    // Only admins or managers can add clients
    if (!["admin", "manager"].includes(role.toLowerCase())) {
      return NextResponse.json(
        { message: "Only admins or managers can add clients" },
        { status: 403 }
      );
    }

    const {
      name,
      email,
      companyName,
      phone,
      longFormVideos,
      shortFormClips,
      socialPosts,
      customDeliverables,
    } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { message: "Client name and email are required" },
        { status: 400 }
      );
    }

    // 🧠 Create Google Drive folder structure
    const driveFolders = await createClientFolders(name);

    // 🧩 Store new client in DB
    const user = await prisma.user.create({
      data: {
        email,
        password: email,
        role: "client",
      }
    })
    
    const newClient = await prisma.client.create({
      data: {
        name,
        email,
        companyName: companyName || null,
        phone: phone || null,
        createdBy: userId,

        // Google Drive folders
        driveFolderId: driveFolders.mainFolderId,
        rawFootageFolderId: driveFolders.rawFolderId,
        essentialsFolderId: driveFolders.essentialsFolderId,

        // Deliverables
        longFormVideos: Number(longFormVideos) || 0,
        shortFormClips: Number(shortFormClips) || 0,
        socialPosts: Number(socialPosts) || 0,
        customDeliverables: customDeliverables || null,
      },
    });

    return NextResponse.json(
      {
        message: "Client created successfully",
        client: newClient,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("❌ Create client error:", err.message);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}
