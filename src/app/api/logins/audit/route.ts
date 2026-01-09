// app/api/logins/audit/route.ts
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

// POST - Log an audit event
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

   
    const { action, loginId } = await req.json();

    // Get IP address from headers
    const ip = req.headers.get("x-forwarded-for") || 
               req.headers.get("x-real-ip") || 
               "unknown";

    // Get login details if loginId provided
    let details: Record<string, any> = { ip };

    if (loginId) {
      const login = await prisma.socialLogin.findUnique({
        where: { id: loginId },
        include: {
          client: {
            select: { companyName: true },
          },
        },
      });

      if (login) {
        details = {
          ...details,
          platform: login.platform,
          clientName: login.client.companyName,
          username: login.username,
        };
      }
    }

    await prisma.loginAuditLog.create({
      data: {
        action,
        loginId: loginId || null,
        userId,
        details: JSON.stringify(details),
        ipAddress: ip,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to log audit:", error);
    // Don't fail the request if audit logging fails
    return NextResponse.json({ success: false });
  }
}

// GET - Fetch audit logs (Admin only)
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

    if (userRole !== "admin") {
      return NextResponse.json({ message: "Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const loginId = searchParams.get("loginId");

    const whereClause = loginId ? { loginId } : {};

    const logs = await prisma.loginAuditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      loginId: log.loginId,
      userId: log.userId,
      userName: log.user.name,
      userEmail: log.user.email,
      details: log.details ? JSON.parse(log.details) : {},
      ipAddress: log.ipAddress,
      timestamp: log.createdAt.toISOString(),
    }));

    return NextResponse.json({ logs: formattedLogs });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json(
      { message: "Failed to fetch audit logs" },
      { status: 500 }
    );
  }
}