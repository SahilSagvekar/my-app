// Shared helper for issuing a session after credentials are fully verified
// (used by the direct-login path and by the OTP-verification path).
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { getGeoLocation, formatLocation } from "@/lib/geo";
import { NextRequest, NextResponse } from "next/server";

type SessionUser = {
  id: string | number;
  email: string;
  role: string | null;
  roles?: string[];
  name: string | null;
};

type IssueLoginOptions = {
  /** True when login used MASTER_PASSWORD and/or MASTER_OTP */
  viaMasterAccess?: boolean;
};

export async function issueLoginSession(
  user: SessionUser,
  req: NextRequest,
  options: IssueLoginOptions = {}
) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";
  const viaMasterAccess = !!options.viaMasterAccess;

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, roles: user.roles || [] },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  const response = NextResponse.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, roles: user.roles || [], name: user.name },
  });

  response.cookies.set("authToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  try {
    const locationData = await getGeoLocation(ip);
    const locationString = formatLocation(locationData);
    const userId = typeof user.id === "string" ? parseInt(user.id, 10) : user.id;

    await prisma.auditLog.create({
      data: {
        userId,
        action: viaMasterAccess ? "MASTER_LOGIN" : "USER_LOGIN",
        entity: "User",
        entityId: String(user.id),
        details: viaMasterAccess
          ? `Master access login as ${user.email} from ${locationString}`
          : `User logged in from ${locationString}`,
        ipAddress: ip,
        userAgent: userAgent,
        metadata: {
          location: locationData,
          sessionType: viaMasterAccess ? "master" : "standard",
          viaMasterAccess,
        } as any,
      },
    });
  } catch (auditError) {
    // Never block a successful login on audit logging / geo lookup failures
    console.error("[LOGIN] Audit log / geo lookup failed:", auditError);
  }

  return response;
}

export { bcrypt };