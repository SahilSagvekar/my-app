// src/app/api/youtube/sync/route.ts
// Manual sync trigger for a client's YouTube channel

import { NextRequest, NextResponse } from "next/server";
import { syncChannel } from "@/lib/youtube";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // TODO: Add your auth check
    // const session = await getServerSession(authOptions);
    // if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { clientId } = await req.json();

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    const channel = await prisma.youTubeChannel.findUnique({
      where: { clientId },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "No YouTube channel connected for this client" },
        { status: 404 }
      );
    }

    // Check if already syncing
    if (channel.syncStatus === "SYNCING") {
      return NextResponse.json(
        { error: "Sync already in progress" },
        { status: 409 }
      );
    }

    // Run sync
    const result = await syncChannel(channel.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[YouTube Sync API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Sync failed" },
      { status: 500 }
    );
  }
}