export const dynamic = 'force-dynamic';
// app/api/logins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { notifyLoginAdded } from "@/lib/login-notifications";
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
    const fullAccessRoles = ["admin", "client"];
    
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

    const isAdmin = userRole === "admin";

    let logins;

    if (isAdmin) {
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
      const userWithClient = await prisma.user.findUnique({
        where: { id: userId },
        select: { linkedClientId: true },
      });

      let clientId = userWithClient?.linkedClientId;

      if (!clientId) {
        const clientByUserId = await prisma.client.findFirst({
          where: { userId: userId },
          select: { id: true },
        });
        clientId = clientByUserId?.id || null;
      }

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
    } else {
      logins = await prisma.socialLogin.findMany({
        where: {
          adminOnly: false,
          OR: [
            { allowedRoles: { has: userRole! } },
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

    const decryptedLogins = logins.map((login) => ({
      id: login.id,
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
      accessRole: login.accessRole,
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

    if (userRole !== "admin" && userRole !== "client") {
      return NextResponse.json({ message: "Only admin or client can add logins" }, { status: 403 });
    }

    const body = await req.json();
    const { clientId, platform, username, password, loginUrl, email, phone, notes, backupCodesLocation, adminOnly, allowedRoles, allowedUserIds, accessRole } = body;

    const isAdminOnlyLogin = adminOnly === true;

    // Facebook/YouTube grant access via email invite + a role, not a shared
    // password — see EMAIL_INVITE_PLATFORMS in Sociallogins.tsx.
    const isEmailInvitePlatform = platform === "Facebook" || platform === "YouTube";

    if (!platform) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }
    if (isEmailInvitePlatform) {
      if (!email || !accessRole) {
        return NextResponse.json({ message: "Email and access role are required" }, { status: 400 });
      }
    } else if (!username || !password) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    if (!isAdminOnlyLogin && !clientId) {
      return NextResponse.json(
        { message: "Client is required when not admin-only" },
        { status: 400 }
      );
    }

    if (isAdminOnlyLogin && userRole !== "admin") {
      return NextResponse.json(
        { message: "Only admins can create admin-only logins" },
        { status: 403 }
      );
    }

    if ((allowedRoles?.length > 0 || allowedUserIds?.length > 0) && userRole !== "admin") {
      return NextResponse.json(
        { message: "Only admins can set access permissions" },
        { status: 403 }
      );
    }

    if (userRole === "client" && clientId) {
      const userWithClient = await prisma.user.findUnique({
        where: { id: userId },
        select: { linkedClientId: true },
      });

      let userClientId = userWithClient?.linkedClientId;

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

    const effectiveUsername = isEmailInvitePlatform ? email : username;
    const encryptedPassword = encrypt(isEmailInvitePlatform ? "" : password);

    const login = await prisma.socialLogin.create({
      data: {
        clientId: isAdminOnlyLogin ? null : (clientId || null),
        platform,
        username: effectiveUsername,
        encryptedPassword,
        loginUrl: loginUrl || null,
        recoveryEmail: email || null,
        recoveryPhone: phone || null,
        notes: notes || null,
        backupCodesLocation: backupCodesLocation || null,
        adminOnly: isAdminOnlyLogin,
        accessRole: isEmailInvitePlatform ? accessRole : null,
        allowedRoles: allowedRoles || [],
        allowedUserIds: allowedUserIds || [],
        updatedById: userId,
      },
    });

    await prisma.loginAuditLog.create({
      data: {
        action: "create",
        loginId: login.id,
        userId: userId,
        details: JSON.stringify(isAdminOnlyLogin ? { platform } : { platform, clientId, allowedRoles, allowedUserIds }),
      },
    });

    // Notify schedulers + admins about the new login (fire-and-forget)
    notifyLoginAdded({
      platform,
      clientName: isAdminOnlyLogin ? null : (client?.companyName || null),
      addedByName: user.name || "Unknown",
      addedByRole: userRole || "unknown",
      isAdminOnly: isAdminOnlyLogin,
    }).catch((err) => console.error("[logins/POST] slack notify failed:", err));

    return NextResponse.json({
      login: {
        id: login.id,
        ...(isAdminOnlyLogin ? {} : {
          clientId: login.clientId,
          clientName: client!.companyName,
        }),
        platform: login.platform,
        username: login.username,
        password: isEmailInvitePlatform ? "" : password,
        loginUrl: login.loginUrl,
        email: login.recoveryEmail,
        phone: login.recoveryPhone,
        notes: login.notes,
        backupCodesLocation: login.backupCodesLocation,
        adminOnly: login.adminOnly,
        accessRole: login.accessRole,
        allowedRoles: login.allowedRoles,
        allowedUserIds: login.allowedUserIds,
        passwordChangedAt: login.createdAt.toISOString(),
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