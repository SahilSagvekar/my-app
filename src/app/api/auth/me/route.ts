export const dynamic = 'force-dynamic';
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

type AuthMeUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  image: string | null;
  linkedClientId: string | null;
  employeeStatus: string | null;
  client: {
    id: string;
    hasPostingServices: boolean;
  } | null;
};

async function getClientLink(user: AuthMeUser) {
  if (user.role !== 'client') {
    return {
      linkedClientId: user.linkedClientId || user.client?.id || null,
      hasPostingServices: user.client?.hasPostingServices ?? true,
    };
  }

  if (user.linkedClientId || user.client?.id) {
    return {
      linkedClientId: user.linkedClientId || user.client?.id,
      hasPostingServices: user.client?.hasPostingServices ?? true,
    };
  }

  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { email: user.email },
        { emails: { has: user.email } },
      ],
    },
    select: {
      id: true,
      hasPostingServices: true,
    },
  });

  return {
    linkedClientId: client?.id || null,
    hasPostingServices: client?.hasPostingServices ?? true,
  };
}

export async function GET(req: Request) {
  try {
    const token = getTokenFromCookies(req);

    // 1. Try Custom JWT Token first
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
        const user = await prisma.user.findFirst({
          where: { id: Number(decoded.userId) },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            image: true,
            linkedClientId: true,
            employeeStatus: true,
            client: {
              select: { id: true, hasPostingServices: true }
            }
          },
        });

        if (user && (user.employeeStatus === 'ACTIVE' || user.email === 'sahilsagvekar230@gmail.com')) {
          const clientLink = await getClientLink(user);
          const processedUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image,
            employeeStatus: user.employeeStatus,
            linkedClientId: clientLink.linkedClientId,
            hasPostingServices: clientLink.hasPostingServices
          };
          return NextResponse.json({ user: processedUser }, { status: 200 });
        }
      } catch {
        // Fall through to NextAuth check if JWT fails
      }
    }

    // 2. Try NextAuth Session (for Google/Slack)
    const session = await auth();
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
          employeeStatus: true,
          client: {
            select: { id: true, hasPostingServices: true }
          }
        },
      });

      if (user && (user.employeeStatus === 'ACTIVE' || user.email === 'sahilsagvekar230@gmail.com')) {
        const clientLink = await getClientLink(user);
        const processedUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          employeeStatus: user.employeeStatus,
          linkedClientId: clientLink.linkedClientId,
          hasPostingServices: clientLink.hasPostingServices
        };
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
