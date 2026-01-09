// app/api/logins/set-pin/route.ts
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

    if (!pin || pin.length !== 6) {
      return NextResponse.json(
        { message: "PIN must be 6 digits" },
        { status: 400 }
      );
    }

    // Hash the PIN before storing
    const hashedPin = await bcrypt.hash(pin, 12);

    // Upsert - create or update
    await prisma.userSecurityPin.upsert({
      where: { userId },
      update: { 
        pinHash: hashedPin,
        updatedAt: new Date(),
      },
      create: {
        userId,
        pinHash: hashedPin,
      },
    });

    // Log PIN change
    await prisma.loginAuditLog.create({
      data: {
        action: "pin_set",
        loginId: null,
        userId,
        details: JSON.stringify({ action: "PIN set/updated" }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to set PIN:", error);
    return NextResponse.json(
      { message: "Failed to set PIN" },
      { status: 500 }
    );
  }
}