export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable, client as clientTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { createTransporter } from '@/lib/mail-transport';

const CAN_EDIT = ['admin', 'manager', 'videographer'];

// PATCH — save the script draft. Does not change scriptStatus — editing a
// script that's already been sent keeps it live for the client, it does
// not need re-sending.
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: taskId } = params;
    const body = await req.json();
    const { content } = body;

    const [updated] = await db.update(shootDetailTable).set({
      scriptContent: content ?? '',
      scriptLastEditedAt: new Date().toISOString(),
      scriptLastEditedBy: user.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(shootDetailTable.taskId, taskId)).returning();

    if (!updated) {
      return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
    }

    return NextResponse.json({ shootDetail: updated });
  } catch (error: any) {
    console.error('[Shoots] Script save error:', error);
    return NextResponse.json({ error: 'Failed to save script' }, { status: 500 });
  }
}

// POST — make the script visible (live) in the client's portal, and email
// them a heads-up. Safe to call again after edits — it just re-notifies;
// the client already sees live content once scriptStatus is 'sent'.
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  const params = await props.params;
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!CAN_EDIT.includes((user.role || '').toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: taskId } = params;

    const [row] = await db
      .select({
        shootId: shootDetailTable.id,
        scriptContent: shootDetailTable.scriptContent,
        taskTitle: taskTable.title,
        clientId: taskTable.clientId,
        clientEmail: clientTable.email,
        clientName: clientTable.name,
        clientCompanyName: clientTable.companyName,
      })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
      .where(eq(shootDetailTable.taskId, taskId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
    }
    if (!row.clientId || !row.clientEmail) {
      return NextResponse.json({ error: 'This shoot has no client to send to' }, { status: 400 });
    }
    if (!row.scriptContent || !row.scriptContent.trim()) {
      return NextResponse.json({ error: 'Write a script before sending it' }, { status: 400 });
    }

    const [updated] = await db.update(shootDetailTable).set({
      scriptStatus: 'sent',
      scriptSentAt: new Date().toISOString(),
      scriptSentBy: user.id,
      updatedAt: new Date().toISOString(),
    }).where(eq(shootDetailTable.taskId, taskId)).returning();

    // Best-effort notification — the portal visibility flip above is the
    // part that actually matters; don't fail the request if only the email
    // notification breaks.
    try {
      const transporter = createTransporter();
      const clientDisplayName = row.clientCompanyName || row.clientName || 'there';
      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://e8productions.com'}/dashboard?page=scripts`;
      await transporter.sendMail({
        from: process.env.MAIL_FROM_ADDRESS || 'no-reply@e8productions.com',
        to: row.clientEmail,
        subject: `Script ready for review${row.taskTitle ? `: ${row.taskTitle}` : ''}`,
        html: `
          <p>Hi ${clientDisplayName},</p>
          <p>A script is ready for your review${row.taskTitle ? ` for <strong>${row.taskTitle}</strong>` : ''}.</p>
          <p><a href="${portalUrl}">View it in your portal</a></p>
          <p>This link always shows the latest version — no need to check back for a new email if it's updated.</p>
        `,
      });
    } catch (emailErr) {
      console.error('[Shoots] Script send-notification email failed:', emailErr);
    }

    return NextResponse.json({ shootDetail: updated });
  } catch (error: any) {
    console.error('[Shoots] Script send error:', error);
    return NextResponse.json({ error: 'Failed to send script' }, { status: 500 });
  }
}