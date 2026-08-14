export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { client } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    jwt.verify(token, process.env.JWT_SECRET!);

    const { id } = await context.params;
    if (!id) return NextResponse.json({ message: "Client id required" }, { status: 400 });

    const [foundClient] = await db.select({ templateHashtags: client.templateHashtags }).from(client).where(eq(client.id, id)).limit(1);

    if (!foundClient) return NextResponse.json({ message: "Client not found" }, { status: 404 });

    return NextResponse.json({ hashtags: foundClient.templateHashtags ?? [] });
  } catch (err) {
    console.error("[GET /api/clients/:id/hashtags]", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
