export const dynamic = 'force-dynamic';
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

    if (!userRole) {
      return NextResponse.json({ message: "Role Not Found" }, { status: 403 });
    }

    // Roles with built-in full access (no per-login permission needed)
    const fullAccessRoles = ["admin", "client", "scheduler"];
    
    // For other roles, check if the user has been granted access to ANY login
    if (!fullAccessRoles.includes(userRole)) {
      const hasAnyAccess = await prisma.socialLogin.findFirst({
        where: {
          OR: [
            { allowedRoles: { has: userRole } },
            { allowedUserIds: { has: userId } },
          ],
        },
        select: { id: true },
      });

      if (!hasAnyAccess) {
        return NextResponse.json({ message: "Access denied" }, { status: 403 });
      }
    }

    // For client role, only show their own logins
    // For non-admin roles, also hide admin-only logins
    // NEW: Also check allowedRoles and allowedUserIds for granular access
    const isAdmin = userRole === "admin";

    let logins;

    if (isAdmin) {
      // Admins see everything
      logins = await prisma.socialLogin.findMany({
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
    } else if (userRole === "client") {
      // Get the client ID for this user (via linkedClientId or fallback to Client.userId)
      const userWithClient = await prisma.user.findUnique({
        where: { id: userId },
        select: { linkedClientId: true },
      });

      let clientId = userWithClient?.linkedClientId;

      // Fallback: check if any client has this userId
      if (!clientId) {
        const clientByUserId = await prisma.client.findFirst({
          where: { userId: userId },
          select: { id: true },
        });
        clientId = clientByUserId?.id || null;
      }

      // Clients only see their own client's logins (and NOT admin-only ones)
      logins = await prisma.socialLogin.findMany({
        where: {
          clientId: clientId || 'NO_CLIENT_FOUND',
          adminOnly: false
        },
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
    } else if (userRole === "scheduler") {
      // Schedulers see ALL logins (except adminOnly ones)
      logins = await prisma.socialLogin.findMany({
        where: {
          adminOnly: false,
        },
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
    } else {
      // Other roles (editor, qc, etc.)
      // They can only see logins where:
      // 1. adminOnly is false AND
      // 2. Their role is in allowedRoles OR their userId is in allowedUserIds
      logins = await prisma.socialLogin.findMany({
        where: {
          adminOnly: false,
          OR: [
            // Role-based access
            { allowedRoles: { has: userRole! } },
            // User-specific access
            { allowedUserIds: { has: userId } },
          ],
        },
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
    }

    // Decrypt passwords before sending
    // Hide client data for admin-only logins
    // Include allowedRoles and allowedUserIds for admin to manage
    const decryptedLogins = logins.map((login) => ({
      id: login.id,
      // Only include client info if NOT adminOnly
      ...(login.adminOnly ? {} : {
        clientId: login.clientId,
        clientName: login.client?.companyName || "Unknown Client",
      }),
      platform: login.platform,
      username: login.username,
      password: decrypt(login.encryptedPassword),
      loginUrl: login.loginUrl,
      email: login.recoveryEmail,
      phone: login.recoveryPhone,
      notes: login.notes,
      backupCodesLocation: login.backupCodesLocation,
      adminOnly: login.adminOnly,
      allowedRoles: login.allowedRoles || [],
      allowedUserIds: login.allowedUserIds || [],
      passwordChangedAt: login.passwordChangedAt?.toISOString() || login.createdAt.toISOString(),
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

    const userRole = user.role;

    // Only admin and client can add logins
    if (userRole !== "admin" && userRole !== "client") {
      return NextResponse.json({ message: "Only admin or client can add logins" }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, platform, username, password, loginUrl, email, phone, notes, backupCodesLocation, adminOnly, allowedRoles, allowedUserIds } = body;

    const isAdminOnlyLogin = adminOnly === true;

    // clientId is required ONLY if adminOnly is false
    if (!platform || !username || !password) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // If NOT adminOnly, clientId is required
    if (!isAdminOnlyLogin && !clientId) {
      return NextResponse.json(
        { message: "Client is required when not admin-only" },
        { status: 400 }
      );
    }

    // Only admins can create admin-only logins
    if (isAdminOnlyLogin && userRole !== "admin") {
      return NextResponse.json(
        { message: "Only admins can create admin-only logins" },
        { status: 403 }
      );
    }

    // Only admins can set allowedRoles and allowedUserIds
    if ((allowedRoles?.length > 0 || allowedUserIds?.length > 0) && userRole !== "admin") {
      return NextResponse.json(
        { message: "Only admins can set access permissions" },
        { status: 403 }
      );
    }

    // If user is a client, verify they can only add logins for their own client
    if (userRole === "client" && clientId) {
      const userWithClient = await prisma.user.findUnique({
        where: { id: userId },
        select: { linkedClientId: true },
      });

      let userClientId = userWithClient?.linkedClientId;

      // Fallback to Client.userId
      if (!userClientId) {
        const clientByUserId = await prisma.client.findFirst({
          where: { userId: userId },
          select: { id: true },
        });
        userClientId = clientByUserId?.id || null;
      }

      if (clientId !== userClientId) {
        return NextResponse.json(
          { message: "You can only add logins for your own client" },
          { status: 403 }
        );
      }
    }

    // Get client info (only if clientId is provided)
    let client = null;
    if (clientId) {
      client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { companyName: true },
      });

      if (!client) {
        return NextResponse.json({ message: "Client not found" }, { status: 404 });
      }
    }

    // Encrypt password before storing
    const encryptedPassword = encrypt(password);

    const login = await prisma.socialLogin.create({
      data: {
        clientId: isAdminOnlyLogin ? null : (clientId || null),
        platform,
        username,
        encryptedPassword,
        loginUrl: loginUrl || null,
        recoveryEmail: email || null,
        recoveryPhone: phone || null,
        notes: notes || null,
        backupCodesLocation: backupCodesLocation || null,
        adminOnly: isAdminOnlyLogin,
        allowedRoles: allowedRoles || [],
        allowedUserIds: allowedUserIds || [],
        updatedById: userId,
      },
    });

    // Log the creation (exclude client info for admin-only logins)
    await prisma.loginAuditLog.create({
      data: {
        action: "create",
        loginId: login.id,
        userId: userId,
        details: JSON.stringify(isAdminOnlyLogin ? { platform } : { platform, clientId, allowedRoles, allowedUserIds }),
      },
    });

    return NextResponse.json({
      login: {
        id: login.id,
        // Only include client info if NOT adminOnly
        ...(isAdminOnlyLogin ? {} : {
          clientId: login.clientId,
          clientName: client!.companyName,
        }),
        platform: login.platform,
        username: login.username,
        password: password, // Return unencrypted for immediate display
        loginUrl: login.loginUrl,
        email: login.recoveryEmail,
        phone: login.recoveryPhone,
        notes: login.notes,
        backupCodesLocation: login.backupCodesLocation,
        adminOnly: login.adminOnly,
        allowedRoles: login.allowedRoles,
        allowedUserIds: login.allowedUserIds,
        passwordChangedAt: login.createdAt.toISOString(), // New login, password just set
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