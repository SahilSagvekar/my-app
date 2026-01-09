// app/api/logins/check-pin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { getServerSession } from "next-auth";
// import { authOptions } from "@/lib/auth";
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
       

    // const userId = parseInt((session.user as any).id);

    const userPin = await prisma.userSecurityPin.findUnique({
      where: { userId },
    });

    return NextResponse.json({ hasPin: !!userPin });
  } catch (error) {
    console.error("Failed to check PIN:", error);
    return NextResponse.json(
      { message: "Failed to check PIN" },
      { status: 500 }
    );
  }
}