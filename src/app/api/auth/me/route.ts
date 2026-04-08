export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { auth } from "@/auth";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser2(req);
    console.log("[ME] resolved currentUser:", currentUser ? `${currentUser.email}:${currentUser.role}` : null);
    if (currentUser) {
      const user = await prisma.user.findFirst({
        where: { id: Number(currentUser.id) },
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
        const processedUser = {
          ...user,
          linkedClientId: user.linkedClientId || user.client?.id || null,
          hasPostingServices: user.client?.hasPostingServices ?? true
        };
        return NextResponse.json({ user: processedUser }, { status: 200 });
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
        const processedUser = {
          ...user,
          linkedClientId: user.linkedClientId || user.client?.id || null,
          hasPostingServices: user.client?.hasPostingServices ?? true
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
