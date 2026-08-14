export const dynamic = 'force-dynamic';
// POST /api/sales-leads/[id]/convert
// Converts a sales lead into a full client record.
// Runs the exact same logic as POST /api/clients (folders, deliverables, recurring tasks, onboarding).

import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { salesLead, user as userTable, client as clientTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { createClientFolders } from '@/lib/s3';
import { createRecurringTasksForClient } from '@/app/api/clients/recurring';
import { redis } from '@/lib/redis';
import { onboardNewClient } from '@/lib/client-onboarding';
import { getVisibleSalesRepIds } from '@/lib/salesManagerPermissions';

function getToken(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { db, closeDb } = getDbPool();
  try {
  try {
    const { id: leadId } = await params;
    const token = getToken(req);
    if (!token) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    if (!['admin', 'manager', 'sales_manager'].includes(decoded.role)) {
      return NextResponse.json({ ok: false, message: 'Only admins/managers can convert leads' }, { status: 403 });
    }

    // ── Load the lead ──────────────────────────────────────────────────────
    const [lead] = await db.select().from(salesLead).where(eq(salesLead.id, leadId)).limit(1);
    if (!lead) return NextResponse.json({ ok: false, message: 'Lead not found' }, { status: 404 });
    if (lead.convertedToClientId) {
      return NextResponse.json({ ok: false, message: 'This lead has already been converted to a client' }, { status: 409 });
    }

    if (decoded.role === 'sales_manager') {
      const visibleRepIds = await getVisibleSalesRepIds(Number(decoded.userId));
      if (!visibleRepIds.includes(lead.userId)) {
        return NextResponse.json({ ok: false, message: 'This lead is outside your permitted reps' }, { status: 403 });
      }
    }

    // ── Read optional overrides from request body ──────────────────────────
    const body = await req.json().catch(() => ({}));

    const name         = body.name        || lead.name;
    const email        = body.email       || lead.email;
    const companyName  = body.companyName || lead.company || lead.name;
    const phone        = body.phone       || lead.phone   || '';
    const accountManagerId = body.accountManagerId || null;
    const hasPostingServices = body.hasPostingServices ?? true;

    if (!name || !email) {
      return NextResponse.json({ ok: false, message: 'Lead must have a name and email to convert' }, { status: 400 });
    }

    // ── Check for duplicate email ──────────────────────────────────────────
    const [existingUser] = await db.select().from(userTable).where(eq(userTable.email, email)).limit(1);
    if (existingUser) {
      return NextResponse.json({
        ok: false,
        message: `A user with email "${email}" already exists. Update the lead's email or manage the client directly.`,
      }, { status: 409 });
    }

    // ── Create R2 folders ──────────────────────────────────────────────────
    const folders = await createClientFolders(companyName);

    // ── DB transaction: user + client + mark lead as converted ────────────
    const { client } = await db.transaction(async (tx) => {
      const [user] = await tx.insert(userTable).values({
        name, email, password: null, role: 'client', updatedAt: new Date().toISOString(),
      }).returning();

      const [client] = await tx.insert(clientTable).values({
        id: createId(),
        name,
        email,
        emails: [],
        companyName: companyName || null,
        phone,
        phones: [],
        createdBy: decoded.userId.toString(),
        userId: user.id,
        accountManagerId,
        status: 'active',
        startDate: new Date().toISOString(),
        renewalDate: null,
        lastActivity: new Date().toISOString(),
        driveFolderId:       folders.mainFolderId,
        rawFootageFolderId:  folders.rawFolderId,
        essentialsFolderId:  folders.elementsFolderId,
        outputsFolderId:     folders.outputsFolderId,
        requiresClientReview: false,
        clientReviewDeliverableTypes: [],
        requiresVideographer: false,
        hasPostingServices,
        currentProgress: { completed: 0, total: 0 },
        updatedAt: new Date().toISOString(),
      }).returning();

      // No deliverables on conversion — admin can add them after
      await createRecurringTasksForClient(client.id, tx);

      // Mark the lead as converted
      await tx.update(salesLead).set({
        status: 'WON',
        convertedToClientId: client.id,
        convertedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(salesLead.id, leadId));

      return { client };
    });

    // ── Invalidate cache ───────────────────────────────────────────────────
    await redis.del('clients:all');

    // ── Onboarding: Slack channel + welcome email (non-blocking) ──────────
    onboardNewClient({
      clientId: client.id,
      clientName: name,
      companyName,
      email,
    }).catch(err => console.error('[Convert Lead] Onboarding error:', err));

    return NextResponse.json({
      ok: true,
      clientId: client.id,
      message: `${companyName} has been converted to a client successfully`,
    }, { status: 201 });

  } catch (err: any) {
    console.error('[Convert Lead] Error:', err);
    return NextResponse.json({ ok: false, message: err.message || 'Conversion failed' }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}