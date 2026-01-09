// app/api/logins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth";
// import { getTokenFromCookies } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encryption";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: NextRequest): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

function verifyToken(token: string): { userId: number; role: string } | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: number;
      role: string;
    };
    return decoded;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

// GET - Fetch all logins (decrypted)
export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    
    if (!token) {
          return NextResponse.json(
            { success: false, error: "Unauthorized - No token provided" },
            { status: 401 }
          );
        }
    
        const decoded = verifyToken(token);
    
        if (!decoded) {
          return NextResponse.json(
            { success: false, error: "Unauthorized - Invalid token" },
            { status: 401 }
          );
        }

        const { userId } = decoded;
        
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                phone: true,
                role: true,
              },
            });
        
            if (!user) {
              return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
              );
            }
    

    const userRole = user.role;
    const allowedRoles = ["admin", "client", "scheduler"];

    if(!userRole){
      return NextResponse.json({ message: "Role Not Found" }, { status: 403 });
    }

    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    // For client role, only show their own logins
    const whereClause = userRole === "client" 
      ? { client: { userId: userId } }
      : {};

    const logins = await prisma.socialLogin.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        updatedByUser: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { client: { companyName: "asc" } },
        { platform: "asc" },
      ],
    });

    // Decrypt passwords before sending
    const decryptedLogins = logins.map((login) => ({
      id: login.id,
      clientId: login.clientId,
      clientName: login.client.companyName,
      platform: login.platform,
      username: login.username,
      password: decrypt(login.encryptedPassword),
      email: login.recoveryEmail,
      phone: login.recoveryPhone,
      notes: login.notes,
      lastUpdated: login.updatedAt.toISOString(),
      updatedBy: login.updatedByUser?.name || "Unknown",
    }));

    return NextResponse.json({ logins: decryptedLogins });
  } catch (error) {
    console.error("Failed to fetch logins:", error);
    return NextResponse.json(
      { message: "Failed to fetch logins" },
      { status: 500 }
    );
  }
}

// POST - Create new login
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req);
    
    if (!token) {
          return NextResponse.json(
            { success: false, error: "Unauthorized - No token provided" },
            { status: 401 }
          );
        }
    
        const decoded = verifyToken(token);
    
        if (!decoded) {
          return NextResponse.json(
            { success: false, error: "Unauthorized - Invalid token" },
            { status: 401 }
          );
        }

        const { userId } = decoded;
        
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                phone: true,
                role: true,
              },
            });
        
            if (!user) {
              return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
              );
            }
    

    if (user.role !== "admin") {
      return NextResponse.json({ message: "Only admin can add logins" }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, platform, username, password, email, phone, notes } = body;

    if (!clientId || !platform || !username || !password) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get client info
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { companyName: true },
    });

    if (!client) {
      return NextResponse.json({ message: "Client not found" }, { status: 404 });
    }

    // Encrypt password before storing
    const encryptedPassword = encrypt(password);

    const login = await prisma.socialLogin.create({
      data: {
        clientId,
        platform,
        username,
        encryptedPassword,
        recoveryEmail: email || null,
        recoveryPhone: phone || null,
        notes: notes || null,
        updatedById: userId,
      },
    });

    // Log the creation
    await prisma.loginAuditLog.create({
      data: {
        action: "create",
        loginId: login.id,
        userId: userId,
        details: JSON.stringify({ platform, clientId }),
      },
    });

    return NextResponse.json({
      login: {
        id: login.id,
        clientId: login.clientId,
        clientName: client.companyName,
        platform: login.platform,
        username: login.username,
        password: password, // Return unencrypted for immediate display
        email: login.recoveryEmail,
        phone: login.recoveryPhone,
        notes: login.notes,
        lastUpdated: login.updatedAt.toISOString(),
        updatedBy: user.name || "Admin",
      },
    });
  } catch (error) {
    console.error("Failed to create login:", error);
    return NextResponse.json(
      { message: "Failed to create login" },
      { status: 500 }
    );
  }
}