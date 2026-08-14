export const dynamic = 'force-dynamic';
// app/api/logins/verify-pin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { user as userTable, userSecurityPin, loginAuditLog } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq } from "drizzle-orm";
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


    const { pin } = await req.json();

    if (!pin) {
      return NextResponse.json({ valid: false, message: "PIN required" });
    }

    const [userPin] = await db.select().from(userSecurityPin).where(eq(userSecurityPin.userId, userId)).limit(1);

    if (!userPin) {
      return NextResponse.json({ valid: false, message: "No PIN set" });
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, userPin.pinHash);

    if (isValid) {
      // Update last verified timestamp
      await db.update(userSecurityPin).set({
        lastVerifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(userSecurityPin.userId, userId));
    } else {
      // Log failed attempt
      await db.insert(loginAuditLog).values({
        id: createId(),
        action: "pin_failed",
        loginId: null,
        userId,
        details: JSON.stringify({
          message: "Failed PIN verification attempt",
          ip: req.headers.get("x-forwarded-for") || "unknown",
        }),
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