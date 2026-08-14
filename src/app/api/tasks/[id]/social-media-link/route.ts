export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getDb } from '@/lib/db';
import { task, postedContent } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { createAuditLog, AuditAction } from '@/lib/audit-logger';
import { invalidatePostedContentCache } from '@/lib/redis';
import { sendToChannel } from '@/lib/slack';

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
  const { db, closeDb } = getDb();
  try {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platform, url, postedAt } = body;
    const user = getUserFromToken(request);

    // Get current task with client info
    const foundTask = await db.query.task.findFirst({
      where: eq(task.id, id),
      columns: {
        socialMediaLinks: true,
        title: true,
        description: true,
        clientId: true,
        status: true,
        deliverableType: true,
      },
      with: {
        monthlyDeliverable: { columns: { type: true } },
        oneOffDeliverable: { columns: { type: true } },
      }
    });

    if (!foundTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Parse existing links (or default to empty array)
    const existingLinks = Array.isArray(foundTask.socialMediaLinks)
      ? foundTask.socialMediaLinks
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
    await db.update(task).set({
      socialMediaLinks: [...existingLinks, newLink],
      updatedAt: new Date().toISOString(),
    }).where(eq(task.id, id));

    // 🔥 Only save to PostedContent if task is SCHEDULED or POSTED
    // Links on in-progress tasks must not appear on the client's posted content screen
    const isScheduledOrPosted = foundTask.status === 'SCHEDULED' || foundTask.status === 'POSTED';
    if (foundTask.clientId && isScheduledOrPosted) {
      try {
        const deliverableType = foundTask.deliverableType ||
          foundTask.monthlyDeliverable?.type ||
          foundTask.oneOffDeliverable?.type ||
          null;

        await db.insert(postedContent).values({
          id: createId(),
          clientId: foundTask.clientId,
          title: foundTask.title || foundTask.description || null,
          platform: platform.toLowerCase(),
          url: normalizedUrl,
          postedAt: new Date(postedAtValue).toISOString(),
          deliverableType: deliverableType,
          taskId: id,
        });
        await invalidatePostedContentCache(foundTask.clientId);
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
          taskTitle: foundTask.title || foundTask.description,
          platform,
          url,
          role: user.role,
        },
      });
    }

    // 📣 Notify #e8-app — one message per link added (this route fires once
    // per link, never batched per task), so schedulers see each post as it happens.
    try {
      const taskTitle = foundTask.title || foundTask.description || 'Task';
      await sendToChannel('e8app', {
        type: 'link_posted',
        title: `🔗 Link Posted — ${platform}`,
        body: `*${taskTitle}* was posted to ${platform}.\n${normalizedUrl}`,
        payload: { taskId: id, clientId: foundTask.clientId },
      });
    } catch (err) {
      console.error('[Slack] Failed to notify e8app channel for posted link:', err);
    }

    return NextResponse.json({ link: newLink });
  } catch (error) {
    console.error("Error adding social media link:", error);
    return NextResponse.json(
      { error: "Failed to add social media link" },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}

// PATCH - Update an existing social media link
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platform, url, postedAt } = body;
    const user = getUserFromToken(request);

    const foundTask = await db.select({
      socialMediaLinks: task.socialMediaLinks,
      title: task.title,
      description: task.description,
      clientId: task.clientId,
    }).from(task).where(eq(task.id, id)).then(rows => rows[0]);

    if (!foundTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const existingLinks = Array.isArray(foundTask.socialMediaLinks)
      ? foundTask.socialMediaLinks as Array<{ platform: string; url: string; postedAt: string; addedBy?: number }>
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

    await db.update(task).set({
      socialMediaLinks: updatedLinks,
      updatedAt: new Date().toISOString(),
    }).where(eq(task.id, id));

    // Keep the mirrored PostedContent row (client-facing view + daily-target
    // counting) in sync — without this, a corrected URL never reaches the
    // client and the old URL keeps counting toward daily targets.
    if (oldLink) {
      try {
        await db.update(postedContent).set({
          url: normalizedUrl,
          ...(postedAt ? { postedAt: new Date(postedAt).toISOString() } : {}),
        }).where(and(
          eq(postedContent.taskId, id),
          eq(postedContent.platform, oldLink.platform.toLowerCase()),
          eq(postedContent.url, oldLink.url),
        ));
        if (foundTask.clientId) await invalidatePostedContentCache(foundTask.clientId);
      } catch (err) {
        console.error('Failed to sync PostedContent on link update:', err);
      }
    }

    if (user) {
      await createAuditLog({
        userId: user.userId,
        action: 'SOCIAL_LINK_UPDATED',
        entity: 'Task',
        entityId: id,
        details: `Updated ${platform} link on task`,
        metadata: {
          taskId: id,
          taskTitle: foundTask.title || foundTask.description,
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

  } finally {
    await closeDb();
  }
}

// DELETE - Remove a social media link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDb();
  try {
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

    const foundTask = await db.select({
      socialMediaLinks: task.socialMediaLinks,
      title: task.title,
      description: task.description,
      clientId: task.clientId,
    }).from(task).where(eq(task.id, id)).then(rows => rows[0]);

    if (!foundTask) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    const existingLinks = Array.isArray(foundTask.socialMediaLinks)
      ? foundTask.socialMediaLinks as Array<{ platform: string; url: string; postedAt: string }>
      : [];

    const deletedLink = existingLinks.find(
      (link) => link.platform.toLowerCase() === platform!.toLowerCase()
    );

    const filteredLinks = existingLinks.filter(
      (link) => link.platform.toLowerCase() !== platform!.toLowerCase()
    );

    await db.update(task).set({
      socialMediaLinks: filteredLinks,
      updatedAt: new Date().toISOString(),
    }).where(eq(task.id, id));

    // Remove the mirrored PostedContent row too — otherwise a deleted link
    // keeps showing on the client's posted-content page and keeps counting
    // toward that day's daily-target completion.
    if (deletedLink) {
      try {
        await db.delete(postedContent).where(and(
          eq(postedContent.taskId, id),
          eq(postedContent.platform, deletedLink.platform.toLowerCase()),
          eq(postedContent.url, deletedLink.url),
        ));
        if (foundTask.clientId) await invalidatePostedContentCache(foundTask.clientId);
      } catch (err) {
        console.error('Failed to sync PostedContent on link delete:', err);
      }
    }

    if (user) {
      await createAuditLog({
        userId: user.userId,
        action: 'SOCIAL_LINK_DELETED',
        entity: 'Task',
        entityId: id,
        details: `Removed ${platform} link from task`,
        metadata: {
          taskId: id,
          taskTitle: foundTask.title || foundTask.description,
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

  } finally {
    await closeDb();
  }
}