export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const currentUser = await getCurrentUser2(req);
    if (!currentUser) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const user = await prisma.user.findFirst({
      where: { id: currentUser.id },
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

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const processedUser = {
      ...user,
      linkedClientId: user.linkedClientId || (user as any).client?.id || null,
      hasPostingServices: (user as any).client?.hasPostingServices ?? true
    };
    delete (processedUser as any).client;

    return NextResponse.json({ user: processedUser }, { status: 200 });
  } catch (error) {
    console.error("DEBUG [ME ROUTE] Error:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
