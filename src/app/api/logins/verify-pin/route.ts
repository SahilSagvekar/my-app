// app/api/logins/verify-pin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";
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
       
   
    const { pin } = await req.json();

    if (!pin) {
      return NextResponse.json({ valid: false, message: "PIN required" });
    }

    const userPin = await prisma.userSecurityPin.findUnique({
      where: { userId },
    });

    if (!userPin) {
      return NextResponse.json({ valid: false, message: "No PIN set" });
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, userPin.pinHash);

    if (isValid) {
      // Update last verified timestamp
      await prisma.userSecurityPin.update({
        where: { userId },
        data: { lastVerifiedAt: new Date() },
      });
    } else {
      // Log failed attempt
      await prisma.loginAuditLog.create({
        data: {
          action: "pin_failed",
          loginId: null,
          userId,
          details: JSON.stringify({ 
            message: "Failed PIN verification attempt",
            ip: req.headers.get("x-forwarded-for") || "unknown",
          }),
        },
      });
    }

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error("Failed to verify PIN:", error);
    return NextResponse.json(
      { message: "Failed to verify PIN" },
      { status: 500 }
    );
  }
}