// app/api/logins/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

    // Only admin and client can update logins
    if (userRole !== "admin" && userRole !== "client") {
      return NextResponse.json(
        { message: "Only admin or client can update logins" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { clientId, platform, username, password, loginUrl, email, phone, notes, backupCodesLocation, adminOnly } = body;

    // Check if login exists
    const existingLogin = await prisma.socialLogin.findUnique({
      where: { id },
    });

    if (!existingLogin) {
      return NextResponse.json({ message: "Login not found" }, { status: 404 });
    }

    // If user is a client, verify the login belongs to their client
    if (userRole === "client") {
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

      if (existingLogin.clientId !== userClientId) {
        return NextResponse.json(
          { message: "You can only edit logins for your own client" },
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

    // Encrypt password if provided
    const encryptedPassword = password
      ? encrypt(password)
      : existingLogin.encryptedPassword;

    // Track if password is being changed
    const passwordIsChanging = !!password;

    const isNewAdminOnly = adminOnly ?? existingLogin.adminOnly;
    const finalClientId = isNewAdminOnly ? null : (clientId || null);

    const login = await prisma.socialLogin.update({
      where: { id },
      data: {
        clientId: finalClientId,
        platform,
        username,
        encryptedPassword,
        loginUrl: loginUrl || null,
        recoveryEmail: email || null,
        recoveryPhone: phone || null,
        notes: notes || null,
        backupCodesLocation: backupCodesLocation || null,
        adminOnly: adminOnly ?? existingLogin.adminOnly,
        updatedById: userId,
        // Update passwordChangedAt only if password is being changed
        ...(passwordIsChanging ? { passwordChangedAt: new Date() } : {}),
      },
    });

    // Log the update
    await prisma.loginAuditLog.create({
      data: {
        action: "update",
        loginId: login.id,
        userId: userId,
        details: JSON.stringify({
          platform,
          clientId,
          passwordChanged: !!password
        }),
      },
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
        passwordChangedAt: passwordIsChanging
          ? new Date().toISOString()
          : (existingLogin.passwordChangedAt?.toISOString() || existingLogin.createdAt.toISOString()),
        lastUpdated: login.updatedAt.toISOString(),
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

    // Only admin and client can delete logins
    if (userRole !== "admin" && userRole !== "client") {
      return NextResponse.json(
        { message: "Only admin or client can delete logins" },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if login exists
    const existingLogin = await prisma.socialLogin.findUnique({
      where: { id },
      include: {
        client: {
          select: { companyName: true },
        },
      },
    });

    if (!existingLogin) {
      return NextResponse.json({ message: "Login not found" }, { status: 404 });
    }

    // If user is a client, verify the login belongs to their client
    if (userRole === "client") {
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

      if (existingLogin.clientId !== userClientId) {
        return NextResponse.json(
          { message: "You can only delete logins for your own client" },
          { status: 403 }
        );
      }
    }

    // Enforce creator-only deletion rule (except for legacy logins)
    if (existingLogin.createdById && existingLogin.createdById !== userId) {
      return NextResponse.json(
        { success: false, message: "You can't delete this password. Only the person who created it can delete it." },
        { status: 403 }
      );
    }

    // Log before deletion
    await prisma.loginAuditLog.create({
      data: {
        action: "delete",
        loginId: id,
        userId: userId,
        details: JSON.stringify({
          platform: existingLogin.platform,
          clientName: existingLogin.client.companyName,
          username: existingLogin.username,
        }),
      },
    });

    // Delete the login
    await prisma.socialLogin.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete login:", error);
    return NextResponse.json(
      { message: "Failed to delete login" },
      { status: 500 }
    );
  }
}