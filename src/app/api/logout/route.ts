export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    // Extract user info before clearing token
    const cookieHeader = req.headers.get("cookie");
    let userId: number | undefined;

    if (cookieHeader) {
      const match = cookieHeader.match(/authToken=([^;]+)/);
      if (match) {
        try {
          const decoded: any = jwt.verify(match[1], process.env.JWT_SECRET!);
          userId = decoded.userId;
        } catch { }
      }
    }

    const response = NextResponse.json({ message: "Logged out successfully" });

    // Clear the authToken cookie
    response.cookies.set("authToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: "lax",
      maxAge: 0, // expires immediately
      path: "/",
    });

    // 🔥 Audit logout
    if (userId) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'USER_LOGOUT',
          entity: 'User',
          entityId: String(userId),
          details: 'User logged out',
          metadata: { sessionEnded: new Date().toISOString() } as any
        }
      });
    }

    return response;
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
