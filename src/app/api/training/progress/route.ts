import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser2 } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { videoId, completed } = body;

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    // Upsert the progress record
    const progress = await prisma.trainingVideoProgress.upsert({
      where: {
        userId_videoId: {
          userId: user.id,
          videoId: videoId,
        },
      },
      update: {
        completed: completed ?? true,
      },
      create: {
        userId: user.id,
        videoId: videoId,
        completed: completed ?? true,
      },
    });

    return NextResponse.json({ progress });
  } catch (err) {
    console.error("POST /api/training/progress error:", err);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}
