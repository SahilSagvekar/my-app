import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "../../../../lib/prisma";
import { auth } from "@/auth";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function GET(req: Request) {
  try {
    const token = getTokenFromCookies(req);

    // 1. Try Custom JWT Token first
    if (token) {
      try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const user = await prisma.user.findFirst({
          where: { id: Number(decoded.userId) },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            image: true,
            linkedClientId: true,
            client: {
              select: { id: true }
            }
          },
        });

        if (user) {
          const processedUser = {
            ...user,
            linkedClientId: user.linkedClientId || (user as any).client?.id || null
          };
          delete (processedUser as any).client;
          return NextResponse.json({ user: processedUser }, { status: 200 });
        }
      } catch (err) {
        // Fall through to NextAuth check if JWT fails
      }
    }

    // 2. Try NextAuth Session (for Google/Slack)
    const session: any = await auth();
    if (session?.user?.email) {
      const user = await prisma.user.findFirst({
        where: { email: session.user.email },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          image: true,
          linkedClientId: true,
          client: {
            select: { id: true }
          }
        },
      });

      if (user) {
        const processedUser = {
          ...user,
          linkedClientId: user.linkedClientId || (user as any).client?.id || null
        };
        delete (processedUser as any).client;
        return NextResponse.json({ user: processedUser }, { status: 200 });
      }
    }

    // No valid auth found
    return NextResponse.json({ user: null }, { status: 200 });
  } catch (error) {
    console.error("DEBUG [ME ROUTE] Error:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
