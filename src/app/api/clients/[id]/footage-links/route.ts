export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
  return prisma.user.findMany({
    where: {
      role: 'editor',
      assignedTasks: {
        some: { clientId, status: { notIn: ['COMPLETED', 'POSTED'] } },
      },
    },
    select: { id: true, name: true, slackUserId: true },
    distinct: ['id'],
  });
}

// GET — fetch all footage links for a client
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      select: { rawFootageLinks: true },
    });
    if (!client) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ links: client.rawFootageLinks ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — add a new footage link
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true, name: true, companyName: true,
        slackEnabled: true, slackWebhookUrl: true,
        rawFootageLinks: true,
      },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const existing = Array.isArray(client.rawFootageLinks) ? client.rawFootageLinks as FootageLink[] : [];

    const newLink: FootageLink = {
      id: randomUUID(),
      url: url.trim(),
      label: label?.trim() || undefined,
      addedByName: user.name || 'Unknown',
      addedByRole: user.role || 'unknown',
      addedAt: new Date().toISOString(),
      folderPath: folderPath || undefined,
    };

    await prisma.client.update({
      where: { id },
      data: { rawFootageLinks: [...existing, newLink] },
    });

    // ── Slack notification ──
    try {
      const clientName = client.companyName || client.name;
      const linkDisplay = label?.trim() ? `${label.trim()} — ${url}` : url;
      const folderDisplay = folderPath ? `\n*Folder:* \`${folderPath}\`` : '';

      if (client.slackEnabled && client.slackWebhookUrl) {
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
        await sendSlackWebhook(notification, client.slackWebhookUrl);
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

    const client = await prisma.client.findUnique({
      where: { id },
      select: { rawFootageLinks: true },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const existing = Array.isArray(client.rawFootageLinks) ? client.rawFootageLinks as FootageLink[] : [];

    // Clients can only delete their own links
    if (user.role === 'client') {
      const link = existing.find(l => l.id === linkId);
      if (link && link.addedByRole !== 'client') {
        return NextResponse.json({ error: 'Cannot delete this link' }, { status: 403 });
      }
    }

    await prisma.client.update({
      where: { id },
      data: { rawFootageLinks: existing.filter(l => l.id !== linkId) },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[footage-links DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}