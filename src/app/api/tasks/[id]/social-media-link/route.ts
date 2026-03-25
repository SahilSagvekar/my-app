export const dynamic = 'force-dynamic';
// app/api/tasks/[id]/social-media-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

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

// PATCH - Update an existing social media link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Parse existing links
    const existingLinks = Array.isArray(task.socialMediaLinks) 
      ? task.socialMediaLinks as Array<{ platform: string; url: string; postedAt: string }>
      : [];

    // Find and update the link for the specified platform
    const updatedLinks = existingLinks.map((link) => {
      if (link.platform.toLowerCase() === platform.toLowerCase()) {
        return {
          ...link,
          url,
          updatedAt: new Date().toISOString(),
        };
      }
      return link;
    });

    // Update task with modified links
    await prisma.task.update({
      where: { id: id },
      data: {
        socialMediaLinks: updatedLinks,
      },
    });

    return NextResponse.json({ success: true, links: updatedLinks });
  } catch (error) {
    console.error("Error updating social media link:", error);
    return NextResponse.json(
      { error: "Failed to update social media link" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a social media link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platform } = body;

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

    // Parse existing links
    const existingLinks = Array.isArray(task.socialMediaLinks) 
      ? task.socialMediaLinks as Array<{ platform: string; url: string; postedAt: string }>
      : [];

    // Filter out the link for the specified platform
    const filteredLinks = existingLinks.filter(
      (link) => link.platform.toLowerCase() !== platform.toLowerCase()
    );

    // Update task with filtered links
    await prisma.task.update({
      where: { id: id },
      data: {
        socialMediaLinks: filteredLinks,
      },
    });

    return NextResponse.json({ success: true, links: filteredLinks });
  } catch (error) {
    console.error("Error deleting social media link:", error);
    return NextResponse.json(
      { error: "Failed to delete social media link" },
      { status: 500 }
    );
  }
}