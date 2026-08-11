export const dynamic = 'force-dynamic';
// app/api/logins/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { user as userTable, client as clientTable, socialLogin, loginAuditLog } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq } from "drizzle-orm";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
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

// PUT - Update login
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Only admin and client can update logins
    if (userRole !== "admin" && userRole !== "client") {
      return NextResponse.json(
        { message: "Only admin or client can update logins" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { clientId, platform, username, password, loginUrl, email, phone, notes, backupCodesLocation, adminOnly, allowedRoles, allowedUserIds, accessRole } = body;

    const isEmailInvitePlatform = platform === "Facebook" || platform === "YouTube";

    // Check if login exists
    const [existingLogin] = await db.select().from(socialLogin).where(eq(socialLogin.id, id)).limit(1);

    if (!existingLogin) {
      return NextResponse.json({ message: "Login not found" }, { status: 404 });
    }

    // If user is a client, verify the login belongs to their client
    if (userRole === "client") {
      const [userWithClient] = await db.select({ linkedClientId: userTable.linkedClientId }).from(userTable).where(eq(userTable.id, userId)).limit(1);

      let userClientId = userWithClient?.linkedClientId;

      // Fallback to Client.userId
      if (!userClientId) {
        const [clientByUserId] = await db.select({ id: clientTable.id }).from(clientTable).where(eq(clientTable.userId, userId)).limit(1);
        userClientId = clientByUserId?.id || null;
      }

      if (existingLogin.clientId !== userClientId) {
        return NextResponse.json(
          { message: "You can only edit logins for your own client" },
          { status: 403 }
        );
      }

      // Clients cannot modify access permissions
      if (allowedRoles !== undefined || allowedUserIds !== undefined) {
        return NextResponse.json(
          { message: "Only admins can modify access permissions" },
          { status: 403 }
        );
      }
    }

    // Get client info (only if clientId is provided)
    let client = null;
    if (clientId) {
      [client] = await db.select({ companyName: clientTable.companyName }).from(clientTable).where(eq(clientTable.id, clientId)).limit(1);

      if (!client) {
        return NextResponse.json({ message: "Client not found" }, { status: 404 });
      }
    }

    // Encrypt password if provided
    const encryptedPassword = password
      ? encrypt(password)
      : existingLogin.encryptedPassword;

    // Track if password is being changed
    const passwordIsChanging = !!password;

    const isNewAdminOnly = adminOnly ?? existingLogin.adminOnly;
    const finalClientId = isNewAdminOnly ? null : (clientId || null);
    const effectiveUsername = isEmailInvitePlatform ? (email || existingLogin.username) : username;

    const [login] = await db.update(socialLogin).set({
      clientId: finalClientId,
      platform,
      username: effectiveUsername,
      encryptedPassword,
      loginUrl: loginUrl || null,
      recoveryEmail: email || null,
      recoveryPhone: phone || null,
      notes: notes || null,
      backupCodesLocation: backupCodesLocation || null,
      adminOnly: adminOnly ?? existingLogin.adminOnly,
      accessRole: isEmailInvitePlatform ? (accessRole ?? existingLogin.accessRole) : null,
      // Only update permissions if provided (admin only)
      ...(allowedRoles !== undefined ? { allowedRoles } : {}),
      ...(allowedUserIds !== undefined ? { allowedUserIds } : {}),
      updatedById: userId,
      updatedAt: new Date().toISOString(),
      // Update passwordChangedAt only if password is being changed
      ...(passwordIsChanging ? { passwordChangedAt: new Date().toISOString() } : {}),
    }).where(eq(socialLogin.id, id)).returning();

    // Log the update
    await db.insert(loginAuditLog).values({
      id: createId(),
      action: "update",
      loginId: login.id,
      userId: userId,
      details: JSON.stringify({
        platform,
        clientId,
        passwordChanged: !!password,
        allowedRoles: allowedRoles ?? existingLogin.allowedRoles,
        allowedUserIds: allowedUserIds ?? existingLogin.allowedUserIds,
      }),
    });

    return NextResponse.json({
      login: {
        id: login.id,
        // Only include client info if NOT adminOnly
        ...(login.adminOnly ? {} : {
          clientId: login.clientId,
          clientName: client?.companyName,
        }),
        platform: login.platform,
        username: login.username,
        password: password || decrypt(existingLogin.encryptedPassword),
        loginUrl: login.loginUrl,
        email: login.recoveryEmail,
        phone: login.recoveryPhone,
        notes: login.notes,
        backupCodesLocation: login.backupCodesLocation,
        adminOnly: login.adminOnly,
        accessRole: login.accessRole,
        allowedRoles: login.allowedRoles,
        allowedUserIds: login.allowedUserIds,
        passwordChangedAt: passwordIsChanging
          ? new Date().toISOString()
          : (existingLogin.passwordChangedAt ? new Date(existingLogin.passwordChangedAt).toISOString() : new Date(existingLogin.createdAt).toISOString()),
        lastUpdated: new Date(login.updatedAt).toISOString(),
        updatedBy: user.name || "Admin",
      },
    });
  } catch (error) {
    console.error("Failed to update login:", error);
    return NextResponse.json(
      { message: "Failed to update login" },
      { status: 500 }
    );
  }
}

// DELETE - Remove login
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Only admin and client can delete logins
    if (userRole !== "admin" && userRole !== "client") {
      return NextResponse.json(
        { message: "Only admin or client can delete logins" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if login exists
    const existingLogin = await db.query.socialLogin.findFirst({
      where: eq(socialLogin.id, id),
      with: {
        client: { columns: { companyName: true } },
      },
    });

    if (!existingLogin) {
      return NextResponse.json({ message: "Login not found" }, { status: 404 });
    }

    // If user is a client, verify the login belongs to their client
    if (userRole === "client") {
      const [userWithClient] = await db.select({ linkedClientId: userTable.linkedClientId }).from(userTable).where(eq(userTable.id, userId)).limit(1);

      let userClientId = userWithClient?.linkedClientId;

      // Fallback to Client.userId
      if (!userClientId) {
        const [clientByUserId] = await db.select({ id: clientTable.id }).from(clientTable).where(eq(clientTable.userId, userId)).limit(1);
        userClientId = clientByUserId?.id || null;
      }

      if (existingLogin.clientId !== userClientId) {
        return NextResponse.json(
          { message: "You can only delete logins for your own client" },
          { status: 403 }
        );
      }
    }

    // Deletion allowed as everything else passed

    // Log before deletion
    await db.insert(loginAuditLog).values({
      id: createId(),
      action: "delete",
      loginId: id,
      userId: userId,
      details: JSON.stringify({
        platform: existingLogin.platform,
        clientName: existingLogin.client?.companyName || "N/A (Admin)",
        username: existingLogin.username,
      }),
    });

    // Delete the login
    await db.delete(socialLogin).where(eq(socialLogin.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete login:", error);
    return NextResponse.json(
      { message: "Failed to delete login" },
      { status: 500 }
    );
  }
}