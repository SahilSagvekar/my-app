// /app/api/me/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "../../../../lib/prisma"; // adjust path if needed

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function GET(req: Request) {
  try {
    const token = getTokenFromCookies(req);

    // No cookie = not logged in
    if (!token) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch (err) {
      // Invalid / expired token = treat as logged out
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const { userId } = decoded;

    const user = await prisma.user.findFirst({
      where: { id: Number(userId) },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    // Never break UI — just return no user
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
