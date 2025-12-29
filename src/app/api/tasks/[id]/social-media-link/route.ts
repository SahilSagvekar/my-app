// app/api/tasks/[id]/social-media-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // Add Promise here
) {
  try {
    const { id } = await params;  // Await params
    const body = await request.json();
    const { platform, url } = body;

    // Get current task
    const task = await prisma.task.findUnique({
      where: { id: id },
      select: { socialMediaLinks: true }
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Parse existing links (or default to empty array)
    const existingLinks = Array.isArray(task.socialMediaLinks) 
      ? task.socialMediaLinks 
      : [];

    // Add new link
    const newLink = {
      platform,
      url,
      postedAt: new Date().toISOString(),
    };

    // Update task with new link
    await prisma.task.update({
      where: { id: id },
      data: {
        socialMediaLinks: [...existingLinks, newLink],
      },
    });

    return NextResponse.json({ link: newLink });
  } catch (error) {
    console.error("Error adding social media link:", error);
    return NextResponse.json(
      { error: "Failed to add social media link" },
      { status: 500 }
    );
  }
}