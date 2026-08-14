export const dynamic = 'force-dynamic';
// app/api/logins/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { user as userTable, client as clientTable, socialLogin, loginAuditLog } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, or, eq, arrayContains, asc } from "drizzle-orm";
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
  const db = getDbHttp();
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

    const [user] = await db.select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      phone: userTable.phone,
      role: userTable.role,
    }).from(userTable).where(eq(userTable.id, userId)).limit(1);

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
      const [hasAnyAccess] = await db.select({ id: socialLogin.id }).from(socialLogin).where(or(
        arrayContains(socialLogin.allowedRoles, [userRole]),
        arrayContains(socialLogin.allowedUserIds, [userId]),
      )).limit(1);

      if (!hasAnyAccess) {
        return NextResponse.json({ message: "Access denied" }, { status: 403 });
      }
    }

    const isAdmin = userRole === "admin";

    let rawLogins;

    if (isAdmin) {
      rawLogins = await db.query.socialLogin.findMany({
        with: {
          client: { columns: { id: true, name: true, companyName: true } },
          user: { columns: { name: true } },
        },
      });
    } else if (userRole === "client") {
      const [userWithClient] = await db.select({ linkedClientId: userTable.linkedClientId }).from(userTable).where(eq(userTable.id, userId)).limit(1);

      let clientId = userWithClient?.linkedClientId;

      if (!clientId) {
        const [clientByUserId] = await db.select({ id: clientTable.id }).from(clientTable).where(eq(clientTable.userId, userId)).limit(1);
        clientId = clientByUserId?.id || null;
      }

      rawLogins = await db.query.socialLogin.findMany({
        where: and(eq(socialLogin.clientId, clientId || 'NO_CLIENT_FOUND'), eq(socialLogin.adminOnly, false)),
        with: {
          client: { columns: { id: true, name: true, companyName: true } },
          user: { columns: { name: true } },
        },
      });
    } else {
      rawLogins = await db.query.socialLogin.findMany({
        where: and(
          eq(socialLogin.adminOnly, false),
          or(
            arrayContains(socialLogin.allowedRoles, [userRole!]),
            arrayContains(socialLogin.allowedUserIds, [userId]),
          ),
        ),
        with: {
          client: { columns: { id: true, name: true, companyName: true } },
          user: { columns: { name: true } },
        },
      });
    }

    // Mirrors the original ORDER BY client.companyName ASC, platform ASC —
    // ordering by a joined relation's column isn't expressible in Drizzle's
    // relational query `orderBy` (main-table columns only), so sort in JS.
    const logins = [...rawLogins].sort((a: any, b: any) => {
      const companyCompare = (a.client?.companyName || "").localeCompare(b.client?.companyName || "");
      if (companyCompare !== 0) return companyCompare;
      return (a.platform || "").localeCompare(b.platform || "");
    });

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
      passwordChangedAt: login.passwordChangedAt ? new Date(login.passwordChangedAt).toISOString() : new Date(login.createdAt).toISOString(),
      lastUpdated: new Date(login.updatedAt).toISOString(),
      updatedBy: (login as any).user?.name || "Unknown",
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
  const db = getDbHttp();
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

    const [user] = await db.select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      phone: userTable.phone,
      role: userTable.role,
    }).from(userTable).where(eq(userTable.id, userId)).limit(1);

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
      const [userWithClient] = await db.select({ linkedClientId: userTable.linkedClientId }).from(userTable).where(eq(userTable.id, userId)).limit(1);

      let userClientId = userWithClient?.linkedClientId;

      if (!userClientId) {
        const [clientByUserId] = await db.select({ id: clientTable.id }).from(clientTable).where(eq(clientTable.userId, userId)).limit(1);
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
      [client] = await db.select({ companyName: clientTable.companyName }).from(clientTable).where(eq(clientTable.id, clientId)).limit(1);

      if (!client) {
        return NextResponse.json({ message: "Client not found" }, { status: 404 });
      }
    }

    const effectiveUsername = isEmailInvitePlatform ? email : username;
    const encryptedPassword = encrypt(isEmailInvitePlatform ? "" : password);

    const [login] = await db.insert(socialLogin).values({
      id: createId(),
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
      updatedAt: new Date().toISOString(),
    }).returning();

    await db.insert(loginAuditLog).values({
      id: createId(),
      action: "create",
      loginId: login.id,
      userId: userId,
      details: JSON.stringify(isAdminOnlyLogin ? { platform } : { platform, clientId, allowedRoles, allowedUserIds }),
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
        passwordChangedAt: new Date(login.createdAt).toISOString(),
        lastUpdated: new Date(login.updatedAt).toISOString(),
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