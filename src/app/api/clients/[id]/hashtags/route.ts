export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// GET /api/clients/:id/hashtags — the client's template hashtag list,
// used by the review screen to populate the tag-selection dropdown.
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    jwt.verify(token, process.env.JWT_SECRET!);

    const { id } = await context.params;
    if (!id) return NextResponse.json({ message: "Client id required" }, { status: 400 });

    const client = await prisma.client.findUnique({
      where: { id },
      select: { templateHashtags: true },
    });

    if (!client) return NextResponse.json({ message: "Client not found" }, { status: 404 });

    return NextResponse.json({ hashtags: client.templateHashtags ?? [] });
  } catch (err) {
    console.error("[GET /api/clients/:id/hashtags]", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
