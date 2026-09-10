export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  preClient as preClientTable,
  client as clientTable,
  user as userTable,
  clientPortalAccess as clientPortalAccessTable,
} from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { createClientFolders } from '@/lib/s3';
import { onboardNewClient } from '@/lib/client-onboarding';
import { createRecurringTasksForClient } from '@/app/api/clients/recurring';

// POST /api/pre-clients/[id]/provision
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getDbHttp();
  try {
    const user = await getCurrentUser2(req);
    if (!user || !['admin', 'manager'].includes(user.role ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: preClientId } = await params;

    // At most one may be true — see onboardNewClient's own precedence rule
    // if a caller (bug) sends both. No admin UI currently lets someone
    // choose here (PreClientsTab's "Provision" button sends no body), so
    // default to sendMagicLink to preserve this route's original
    // always-send-a-magic-link behavior — same reasoning as sales-leads/
    // convert's explicit sendWelcomeEmail:true default.
    const body = await req.json().catch(() => ({}));
    const sendWelcomeEmail = body?.sendWelcomeEmail === true;
    const sendMagicLink = body?.sendMagicLink === true || (!body?.sendWelcomeEmail && !body?.sendMagicLink);

    const preClient = await db.query.preClient.findFirst({
      where: (pc, { eq }) => eq(pc.id, preClientId),
    });

    if (!preClient) {
      return NextResponse.json({ error: 'Pre-client not found' }, { status: 404 });
    }

    if (preClient.status === 'CONVERTED') {
      return NextResponse.json({ error: 'Already provisioned' }, { status: 400 });
    }

    if (preClient.status !== 'QUOTE_ACCEPTED') {
      return NextResponse.json(
        { error: 'Quote must be accepted before provisioning' },
        { status: 400 }
      );
    }

    // Check if a client with this email already exists (idempotency)
    const [existingClient] = await db.select().from(clientTable).where(eq(clientTable.email, preClient.email)).limit(1);
    if (existingClient) {
      return NextResponse.json({ error: 'A client with this email already exists' }, { status: 400 });
    }

    // Atomically claim this pre-client for provisioning. The two checks
    // above are plain reads and can't stop a double-click (or two admins
    // clicking at once) from both passing them and racing to create
    // duplicate R2 folders, Slack channels, contracts, and onboarding
    // emails. This update only succeeds for whichever request gets there
    // first — everyone else sees count === 0 and bails before doing any
    // side effects.
    const claim = await db.update(preClientTable)
      .set({ status: 'PROVISIONING', updatedAt: new Date().toISOString() })
      .where(and(eq(preClientTable.id, preClientId), eq(preClientTable.status, 'QUOTE_ACCEPTED')))
      .returning({ id: preClientTable.id });
    if (claim.length === 0) {
      return NextResponse.json(
        { error: 'Pre-client is already being provisioned' },
        { status: 409 }
      );
    }

    // 1. Create R2 folders (outside DB — slow, keep separate)
    const folders = await createClientFolders(
      preClient.companyName || preClient.name
    ).catch(() => ({
      mainFolderId: null,
      rawFolderId: null,
      elementsFolderId: null,
      outputsFolderId: null,
    }));

    // 2. Create portal User
    const [portalUser] = await db.insert(userTable).values({
      name: preClient.name,
      email: preClient.email,
      password: null,
      role: 'client',
      updatedAt: new Date().toISOString(),
    }).returning();

    // 3. Create Client record
    const [client] = await db.insert(clientTable).values({
      id: createId(),
      name: preClient.name,
      email: preClient.email,
      phone: preClient.phone || '',
      companyName: preClient.companyName || null,
      address: preClient.address || null,
      status: 'active',
      startDate: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      preClientId: preClient.id,
      portalPasswordSet: false,
      welcomeVideoWatched: false,
      driveFolderId: folders.mainFolderId,
      rawFootageFolderId: folders.rawFolderId,
      essentialsFolderId: folders.elementsFolderId,
      outputsFolderId: folders.outputsFolderId,
      currentProgress: { completed: 0, total: 0 },
      userId: portalUser.id,
      updatedAt: new Date().toISOString(),
    }).returning();

    // 4. Create ClientPortalAccess
    await db.insert(clientPortalAccessTable).values({
      id: createId(),
      clientId: client.id,
      status: 'ONBOARDING',
      updatedAt: new Date().toISOString(),
    });

    // 4b. Onboarding email — Slack channel + at most one of welcome-email /
    // magic-link, chosen via the same two checkboxes used when creating a
    // plain client (see onboardNewClient in client-onboarding.ts). Quote
    // PDF generation and contract auto-generation/SignWell-send used to
    // happen here — both have been removed entirely from onboarding.
    await onboardNewClient({
      clientId: client.id,
      clientName: preClient.name,
      companyName: preClient.companyName || preClient.name,
      email: preClient.email,
      sendWelcomeEmail: !!sendWelcomeEmail,
      sendMagicLink: !!sendMagicLink,
    }).catch((err) => console.error('[Provision] Onboarding error:', err));

    // 5. Mark pre-client as converted
    await db.update(preClientTable).set({
      status: 'CONVERTED',
      updatedAt: new Date().toISOString(),
    }).where(eq(preClientTable.id, preClientId));

    createRecurringTasksForClient(client.id, db).catch((err: any) =>
      console.error('[Provision] Recurring tasks failed:', err)
    );

    console.log(`✅ [Provision] Client created: ${client.name}`);

    return NextResponse.json({
      success: true,
      clientId: client.id,
    });
  } catch (err: any) {
    console.error('POST /api/pre-clients/[id]/provision error:', err);
    // Best-effort rollback — otherwise a failed provision leaves the
    // pre-client stuck in PROVISIONING forever with no Client ever created,
    // and the claim above would reject every retry.
    try {
      const { id: pid } = await params;
      await db.update(preClientTable)
        .set({ status: 'QUOTE_ACCEPTED', updatedAt: new Date().toISOString() })
        .where(and(eq(preClientTable.id, pid), eq(preClientTable.status, 'PROVISIONING')));
    } catch {}
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}