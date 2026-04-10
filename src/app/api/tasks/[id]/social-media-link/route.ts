export const dynamic = 'force-dynamic';
// app/api/tasks/[id]/social-media-link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { createAuditLog, AuditAction } from '@/lib/audit-logger';

// function getTokenFromCookies(req: Request) {
//   const cookieHeader = req.headers.get("cookie");
//   if (!cookieHeader) return null;
//   const m = cookieHeader.match(/authToken=([^;]+)/);
//   return m ? m[1] : null;
// }

// function getUserFromToken(req: Request): { userId: number; role: string } | null {
//   try {
//     const token = getTokenFromCookies(req);
//     if (!token) return null;
//     const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
//     return { userId: decoded.userId, role: decoded.role };
//   } catch {
//     return null;
//   }
// }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platform, url, postedAt } = body;
    const user = getUserFromToken(request);

    // Get current task
    const task = await prisma.task.findUnique({
      where: { id: id },
      select: { socialMediaLinks: true, title: true, description: true },
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

    // Add new link with user info
    const newLink = {
      platform,
      url,
      postedAt: postedAt || new Date().toISOString(),
      addedBy: user?.userId || null,
    };

    // Update task with new link
    await prisma.task.update({
      where: { id: id },
      data: {
        socialMediaLinks: [...existingLinks, newLink],
      },
    });

    if (user) {
      await createAuditLog({
        userId: user.userId,
        action: 'SOCIAL_LINK_ADDED',
        entity: 'Task',
        entityId: id,
        details: `Added ${platform} link to task`,
        metadata: {
          taskId: id,
          taskTitle: task.title || task.description,
          platform,
          url,
          role: user.role,
        },
      });
    }

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
    const { platform, url, postedAt } = body;
    const user = getUserFromToken(request);

    // Get current task
    const task = await prisma.task.findUnique({
      where: { id: id },
      select: { socialMediaLinks: true, title: true, description: true }
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Parse existing links
    const existingLinks = Array.isArray(task.socialMediaLinks) 
      ? task.socialMediaLinks as Array<{ platform: string; url: string; postedAt: string; addedBy?: number }>
      : [];

    // Find old URL for audit log
    const oldLink = existingLinks.find(l => l.platform.toLowerCase() === platform.toLowerCase());

    // Find and update the link for the specified platform
    const updatedLinks = existingLinks.map((link) => {
      if (link.platform.toLowerCase() === platform.toLowerCase()) {
        return {
          ...link,
          url,
          ...(postedAt ? { postedAt } : {}),
          updatedAt: new Date().toISOString(),
          updatedBy: user?.userId || null,
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

    // 📝 Audit log
    if (user) {
      await createAuditLog({
        userId: user.userId,
        action: 'SOCIAL_LINK_UPDATED',
        entity: 'Task',
        entityId: id,
        details: `Updated ${platform} link on task`,
        metadata: {
          taskId: id,
          taskTitle: task.title || task.description,
          platform,
          oldUrl: oldLink?.url,
          newUrl: url,
          role: user.role,
        },
      });
    }

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
    const user = getUserFromToken(request);

    // Get current task
    const task = await prisma.task.findUnique({
      where: { id: id },
      select: { socialMediaLinks: true, title: true, description: true }
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

    // Find the link being deleted for audit log
    const deletedLink = existingLinks.find(
      (link) => link.platform.toLowerCase() === platform.toLowerCase()
    );

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

    // 📝 Audit log
    if (user) {
      await createAuditLog({
        userId: user.userId,
        action: 'SOCIAL_LINK_DELETED',
        entity: 'Task',
        entityId: id,
        details: `Removed ${platform} link from task`,
        metadata: {
          taskId: id,
          taskTitle: task.title || task.description,
          platform,
          deletedUrl: deletedLink?.url,
          role: user.role,
        },
      });
    }

    return NextResponse.json({ success: true, links: filteredLinks });
  } catch (error) {
    console.error("Error deleting social media link:", error);
    return NextResponse.json(
      { error: "Failed to delete social media link" },
      { status: 500 }
    );
  }
}
