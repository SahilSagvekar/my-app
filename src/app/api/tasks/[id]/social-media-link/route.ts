export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { createAuditLog, AuditAction } from '@/lib/audit-logger';
import { invalidatePostedContentCache } from '@/lib/redis';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/authToken=([^;]+)/);
  return m ? m[1] : null;
}

function getUserFromToken(req: Request): { userId: number; role: string } | null {
  try {
    const token = getTokenFromCookies(req);
    if (!token) return null;
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

// Schedulers often paste URLs without a scheme (e.g. "facebook.com/12345").
// Without normalizing, that gets stored and later rendered as a relative
// <a href>, which the browser resolves against the current origin —
// producing "https://e8productions.com/facebook.com/12345".
function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platform, url, postedAt } = body;
    const user = getUserFromToken(request);

    // Get current task with client info
    const task = await prisma.task.findUnique({
      where: { id: id },
      select: {
        socialMediaLinks: true,
        title: true,
        description: true,
        clientId: true,
        status: true,
        deliverableType: true,
        monthlyDeliverable: { select: { type: true } },
        oneOffDeliverable: { select: { type: true } },
      }
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
    const postedAtValue = postedAt || new Date().toISOString();
    const normalizedUrl = normalizeUrl(url);
    const newLink = {
      platform,
      url: normalizedUrl,
      postedAt: postedAtValue,
      addedBy: user?.userId || null,
    };

    // Update task with new link
    await prisma.task.update({
      where: { id: id },
      data: {
        socialMediaLinks: [...existingLinks, newLink],
      },
    });

    // 🔥 Only save to PostedContent if task is SCHEDULED or POSTED
    // Links on in-progress tasks must not appear on the client's posted content screen
    const isScheduledOrPosted = task.status === 'SCHEDULED' || task.status === 'POSTED';
    if (task.clientId && isScheduledOrPosted) {
      try {
        const deliverableType = task.deliverableType ||
          task.monthlyDeliverable?.type ||
          task.oneOffDeliverable?.type ||
          null;

        await prisma.postedContent.create({
          data: {
            clientId: task.clientId,
            title: task.title || task.description || null,
            platform: platform.toLowerCase(),
            url: normalizedUrl,
            postedAt: new Date(postedAtValue),
            deliverableType: deliverableType,
            taskId: id,
          },
        });
        await invalidatePostedContentCache(task.clientId);
        console.log(`✅ PostedContent created for task ${id}, platform ${platform}`);
      } catch (err) {
        console.error('Failed to save to PostedContent:', err);
      }
    }

    // 📝 Audit log
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

    const existingLinks = Array.isArray(task.socialMediaLinks)
      ? task.socialMediaLinks as Array<{ platform: string; url: string; postedAt: string; addedBy?: number }>
      : [];

    const oldLink = existingLinks.find(l => l.platform.toLowerCase() === platform.toLowerCase());
    const normalizedUrl = normalizeUrl(url);

    const updatedLinks = existingLinks.map((link) => {
      if (link.platform.toLowerCase() === platform.toLowerCase()) {
        return {
          ...link,
          url: normalizedUrl,
          ...(postedAt ? { postedAt } : {}),
          updatedAt: new Date().toISOString(),
          updatedBy: user?.userId || null,
        };
      }
      return link;
    });

    await prisma.task.update({
      where: { id: id },
      data: {
        socialMediaLinks: updatedLinks,
      },
    });

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

    let platform: string | null = null;

    try {
      const body = await request.json();
      platform = body.platform;
    } catch {
      const url = new URL(request.url);
      platform = url.searchParams.get('platform');
    }

    if (!platform) {
      return NextResponse.json(
        { error: "Platform is required" },
        { status: 400 }
      );
    }

    const user = getUserFromToken(request);

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

    const existingLinks = Array.isArray(task.socialMediaLinks)
      ? task.socialMediaLinks as Array<{ platform: string; url: string; postedAt: string }>
      : [];

    const deletedLink = existingLinks.find(
      (link) => link.platform.toLowerCase() === platform!.toLowerCase()
    );

    const filteredLinks = existingLinks.filter(
      (link) => link.platform.toLowerCase() !== platform!.toLowerCase()
    );

    await prisma.task.update({
      where: { id: id },
      data: {
        socialMediaLinks: filteredLinks,
      },
    });

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