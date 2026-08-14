export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { syncYouTubeChannel } from "@/lib/youtube-sync-service";
import { getDbHttp } from "@/lib/db";
import { youTubeChannel } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser2, resolveClientIdForUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    let clientId = body.clientId;

    // If user is a client, they can only sync their own data
    if (user.role === 'client') {
      // 🔥 FIX: Use resolveClientIdForUser for multi-user client support
      const resolvedClientId = await resolveClientIdForUser(user.id);

      if (!resolvedClientId) {
        return NextResponse.json(
          { error: "Client profile not found" },
          { status: 404 }
        );
      }
      clientId = resolvedClientId;
    }

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    const [channel] = await db.select().from(youTubeChannel)
      .where(eq(youTubeChannel.clientId, clientId)).limit(1);

    if (!channel) {
      return NextResponse.json(
        { error: "No YouTube channel connected for this client" },
        { status: 404 }
      );
    }

    // Run sync
    const result = await syncYouTubeChannel(clientId);

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Sync failed" }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[YouTube Sync API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Sync failed" },
      { status: 500 }
    );
  }
}