export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { client, user as userTable, task } from '@/lib/db/schema';
import { and, or, eq, exists, notInArray, arrayContains } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { sendSlackWebhook, sendToChannel, SlackNotification } from '@/lib/slack';
import { randomUUID } from 'crypto';

interface FootageLink {
  id: string;
  url: string;
  label?: string;
  addedByName: string;
  addedByRole: string;
  addedAt: string;
  folderPath?: string; // e.g. "raw-footage/June-2025/LF"
}

async function getClientEditors(clientId: string) {
  const db = getDbHttp();
  return db.select({ id: userTable.id, name: userTable.name, slackUserId: userTable.slackUserId }).from(userTable).where(and(
    or(eq(userTable.role, 'editor'), arrayContains(userTable.roles, ['editor'])),
    exists(db.select().from(task).where(and(
      eq(task.assignedTo, userTable.id),
      eq(task.clientId, clientId),
      notInArray(task.status, ['COMPLETED', 'POSTED'] as any),
    ))),
  ));
}

// GET — fetch all footage links for a client
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const [foundClient] = await db.select({ rawFootageLinks: client.rawFootageLinks }).from(client).where(eq(client.id, id)).limit(1);
    if (!foundClient) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ links: foundClient.rawFootageLinks ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — add a new footage link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowedRoles = ['admin', 'manager', 'editor', 'client'];
    if (!allowedRoles.includes(user.role?.toLowerCase() ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { url, label, folderPath } = await req.json();

    if (!url?.trim()) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    // Validate URL
    try { new URL(url); } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const [foundClient] = await db.select({
      id: client.id, name: client.name, companyName: client.companyName,
      slackEnabled: client.slackEnabled, slackWebhookUrl: client.slackWebhookUrl,
      rawFootageLinks: client.rawFootageLinks,
    }).from(client).where(eq(client.id, id)).limit(1);
    if (!foundClient) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const existing = Array.isArray(foundClient.rawFootageLinks) ? foundClient.rawFootageLinks as FootageLink[] : [];

    const newLink: FootageLink = {
      id: randomUUID(),
      url: url.trim(),
      label: label?.trim() || undefined,
      addedByName: user.name || 'Unknown',
      addedByRole: user.role || 'unknown',
      addedAt: new Date().toISOString(),
      folderPath: folderPath || undefined,
    };

    await db.update(client).set({
      rawFootageLinks: [...existing, newLink],
      updatedAt: new Date().toISOString(),
    }).where(eq(client.id, id));

    // ── Slack notification ──
    try {
      const clientName = foundClient.companyName || foundClient.name;
      const linkDisplay = label?.trim() ? `${label.trim()} — ${url}` : url;
      const folderDisplay = folderPath ? `\n*Folder:* \`${folderPath}\`` : '';

      if (foundClient.slackEnabled && foundClient.slackWebhookUrl) {
        // Send to client's channel and mention assigned editors
        const editors = await getClientEditors(id);
        const mentions = editors.filter(e => e.slackUserId).map(e => `<@${e.slackUserId}>`).join(' ');
        const title = mentions
          ? `${mentions} 📎 Raw footage link added for ${clientName}`
          : `📎 Raw footage link added for ${clientName}`;

        const notification: SlackNotification = {
          type: 'file_uploaded',
          title,
          body: `*Link:* ${linkDisplay}${folderDisplay}\n*Added by:* ${user.name} (${user.role})`,
          payload: { clientId: id },
        };
        await sendSlackWebhook(notification, foundClient.slackWebhookUrl);
      } else {
        // Fall back to E8 app channel
        const notification: SlackNotification = {
          type: 'file_uploaded',
          title: `📎 Raw footage link added for ${clientName}`,
          body: `*Link:* ${linkDisplay}${folderDisplay}\n*Added by:* ${user.name} (${user.role})`,
          payload: { clientId: id },
        };
        await sendToChannel('e8app', notification);
      }
    } catch (slackErr) {
      console.error('[footage-links] Slack notification failed:', slackErr);
    }

    return NextResponse.json({ success: true, link: newLink });
  } catch (err: any) {
    console.error('[footage-links POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — remove a footage link by id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowedRoles = ['admin', 'manager', 'editor', 'client'];
    if (!allowedRoles.includes(user.role?.toLowerCase() ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const { linkId } = await req.json();
    if (!linkId) return NextResponse.json({ error: 'linkId required' }, { status: 400 });

    const [foundClient] = await db.select({ rawFootageLinks: client.rawFootageLinks }).from(client).where(eq(client.id, id)).limit(1);
    if (!foundClient) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const existing = Array.isArray(foundClient.rawFootageLinks) ? foundClient.rawFootageLinks as FootageLink[] : [];

    // Clients can only delete their own links
    if (user.role === 'client') {
      const link = existing.find(l => l.id === linkId);
      if (link && link.addedByRole !== 'client') {
        return NextResponse.json({ error: 'Cannot delete this link' }, { status: 403 });
      }
    }

    await db.update(client).set({
      rawFootageLinks: existing.filter(l => l.id !== linkId),
      updatedAt: new Date().toISOString(),
    }).where(eq(client.id, id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[footage-links DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}