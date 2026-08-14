import { NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { user as userTable, client as clientTable } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import jwt from "jsonwebtoken";
import { createClientFolders } from "@/lib/s3";

// Extract JWT from cookies
function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(req: Request) {
  const db = getDbHttp();
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
    // User.updatedAt is @updatedAt in Prisma (client-managed, no DB default)
    // — set explicitly on insert, matching that behavior.
    const [user] = await db.insert(userTable).values({
      email,
      password: email,
      role: "client",
      updatedAt: new Date().toISOString(),
    }).returning();

    // NOTE (pre-existing, not introduced by this conversion): Client.createdBy
    // is a text/String column, but `userId` here comes from the JWT payload
    // (User.id, an Int) — same type mismatch existed in the original Prisma
    // code. Left as-is.
    //
    // NOTE (schema drift): `longFormVideos`, `shortFormClips`, `socialPosts`,
    // `customDeliverables` are not columns on Client in prisma/schema.prisma
    // or src/lib/db/schema.ts — dropped per hard rule 7 (see migration
    // report). This create call was likely already broken/ignoring these
    // fields under Prisma too.
    const [newClient] = await db.insert(clientTable).values({
      id: createId(),
      name,
      email,
      companyName: companyName || null,
      // Client.phone is NOT NULL — passing null here (as the original Prisma
      // code did) will fail the DB constraint if `phone` is falsy. Pre-existing
      // bug, preserved as-is; `as any` only to satisfy the stricter Drizzle
      // insert type (Prisma's generated input type let this slip through).
      phone: (phone || null) as any,
      createdBy: userId,

      // Google Drive folders
      driveFolderId: driveFolders.mainFolderId,
      rawFootageFolderId: driveFolders.rawFolderId,
      essentialsFolderId: driveFolders.essentialsFolderId,

      updatedAt: new Date().toISOString(),
    }).returning();

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
