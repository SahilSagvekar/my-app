// src/lib/strikes.ts
//
// Three-strike discipline system.
//
//   Who can strike whom (enforced here, never only in the UI):
//     - admin         -> anyone except clients (admins can strike each other)
//     - videographer  -> editors only
//     - nobody can strike themselves, a client, or an already-inactive account
//
//   A person's strike count = their Strike rows with revokedAt IS NULL.
//   The 3rd active strike sets User.employeeStatus = 'TERMINATED' in the same
//   transaction that inserts it (existing auth already blocks non-ACTIVE
//   accounts). Revoking a strike never reinstates a terminated account — an
//   admin does that separately in User Management.

import { getDbHttp, getDbPool } from '@/lib/db';
import { strike, user as userTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { notifyUser } from '@/lib/notify';
import { sendRawEmail } from '@/lib/email';
import { renderEmailShell } from '@/lib/email-shell';

export const MAX_STRIKES = 3;
export const MIN_REASON_LENGTH = 5;
export const MAX_REASON_LENGTH = 1000;

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://e8productions.com';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class StrikeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'StrikeError';
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export type StrikeActor = {
  id: number;
  role?: string | null;
  roles?: string[] | null;
  employeeStatus?: string | null;
};

export type StrikeTarget = StrikeActor;

function rolesOf(u: { role?: string | null; roles?: string[] | null }): Set<string> {
  const out = new Set<string>();
  if (u.role) out.add(String(u.role).toLowerCase());
  for (const r of u.roles ?? []) if (r) out.add(String(r).toLowerCase());
  return out;
}

export function isActiveAccount(u: { employeeStatus?: string | null }): boolean {
  return !u.employeeStatus || u.employeeStatus === 'ACTIVE';
}

/** 'admin' wins when an account has both roles. */
export function strikerKind(actor: StrikeActor): 'admin' | 'videographer' | null {
  const r = rolesOf(actor);
  if (r.has('admin')) return 'admin';
  if (r.has('videographer')) return 'videographer';
  return null;
}

export function isAdminActor(actor: StrikeActor): boolean {
  return rolesOf(actor).has('admin');
}

export type RuleResult = { ok: true } | { ok: false; error: string; status: number };

/** Whether `actor` is allowed to send a strike to `target`. */
export function checkCanStrike(actor: StrikeActor, target: StrikeTarget): RuleResult {
  const kind = strikerKind(actor);
  if (!kind) {
    return { ok: false, error: 'Only admins and videographers can send strikes', status: 403 };
  }
  if (!isActiveAccount(actor)) {
    return { ok: false, error: 'Your account is not active', status: 403 };
  }
  if (actor.id === target.id) {
    return { ok: false, error: 'You cannot send a strike to yourself', status: 400 };
  }
  if (String(target.role ?? '').toLowerCase() === 'client') {
    return { ok: false, error: 'Strikes cannot be sent to clients', status: 403 };
  }
  if (!isActiveAccount(target)) {
    return { ok: false, error: 'This account is no longer active', status: 400 };
  }
  if (kind === 'videographer' && !rolesOf(target).has('editor')) {
    return { ok: false, error: 'Videographers can only send strikes to editors', status: 403 };
  }
  return { ok: true };
}

export function validateReason(raw: unknown): string {
  const reason = typeof raw === 'string' ? raw.trim() : '';
  if (reason.length < MIN_REASON_LENGTH) {
    throw new StrikeError(`Please give a reason (at least ${MIN_REASON_LENGTH} characters)`, 400);
  }
  if (reason.length > MAX_REASON_LENGTH) {
    throw new StrikeError(`Reason is too long (max ${MAX_REASON_LENGTH} characters)`, 400);
  }
  return reason;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type StrikeView = {
  id: string;
  reason: string;
  createdAt: string;
  sender: { id: number; name: string | null } | null;
  revoked: boolean;
  revokedAt: string | null;
  revokeReason: string | null;
  triggeredTermination: boolean;
};

export type StrikeSummary = {
  activeCount: number;
  max: number;
  strikes: StrikeView[]; // newest first; includes revoked ones, flagged
};

// Display names for a set of user ids (plain lookup — avoids aliased self-joins
// on the User table).
async function namesById(db: ReturnType<typeof getDbHttp>, ids: number[]) {
  const unique = [...new Set(ids)];
  const map = new Map<number, string | null>();
  if (unique.length === 0) return map;
  const rows = await db
    .select({ id: userTable.id, name: userTable.name })
    .from(userTable)
    .where(inArray(userTable.id, unique));
  for (const r of rows) map.set(r.id, r.name);
  return map;
}

/** Everything a person sees about their own strikes. */
export async function getStrikeSummary(userId: number): Promise<StrikeSummary> {
  const db = getDbHttp();

  const rows = await db
    .select({
      id: strike.id,
      reason: strike.reason,
      createdAt: strike.createdAt,
      senderId: strike.senderId,
      revokedAt: strike.revokedAt,
      revokeReason: strike.revokeReason,
      triggeredTermination: strike.triggeredTermination,
    })
    .from(strike)
    .where(eq(strike.recipientId, userId))
    .orderBy(desc(strike.createdAt));

  const names = await namesById(db, rows.map((r) => r.senderId));

  const strikes: StrikeView[] = rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    createdAt: r.createdAt,
    sender: { id: r.senderId, name: names.get(r.senderId) ?? null },
    revoked: !!r.revokedAt,
    revokedAt: r.revokedAt,
    revokeReason: r.revokeReason,
    triggeredTermination: r.triggeredTermination,
  }));

  return {
    activeCount: strikes.filter((s) => !s.revoked).length,
    max: MAX_STRIKES,
    strikes,
  };
}

export type EligibleRecipient = {
  id: number;
  name: string | null;
  email: string;
  image: string | null;
  role: string | null;
  roles: string[];
  activeStrikes: number;
};

/** Active, non-client accounts `actor` may strike, with their current counts. */
export async function listEligibleRecipients(actor: StrikeActor): Promise<EligibleRecipient[]> {
  if (!strikerKind(actor)) return [];
  const db = getDbHttp();

  const users = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: userTable.role,
      roles: userTable.roles,
      employeeStatus: userTable.employeeStatus,
    })
    .from(userTable)
    .where(or(isNull(userTable.employeeStatus), eq(userTable.employeeStatus, 'ACTIVE')));

  const eligible = users.filter(
    (u) => checkCanStrike(actor, { ...u, roles: (u.roles as string[] | null) ?? [] }).ok,
  );
  if (eligible.length === 0) return [];

  const counts = await db
    .select({
      recipientId: strike.recipientId,
      count: sql<number>`count(*)::int`,
    })
    .from(strike)
    .where(and(isNull(strike.revokedAt), inArray(strike.recipientId, eligible.map((u) => u.id))))
    .groupBy(strike.recipientId);
  const countMap = new Map(counts.map((c) => [c.recipientId, Number(c.count)]));

  return eligible
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role as string | null,
      roles: ((u.roles as string[] | null) ?? []).map(String),
      activeStrikes: countMap.get(u.id) ?? 0,
    }))
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
}

export type StrikeHistoryItem = StrikeView & {
  recipient: { id: number; name: string | null };
  revokedBy: { id: number; name: string | null } | null;
};

/** Admin: every strike. Videographer: only the strikes they sent. */
export async function listStrikeHistory(actor: StrikeActor, limit = 200): Promise<StrikeHistoryItem[]> {
  const kind = strikerKind(actor);
  if (!kind) return [];
  const db = getDbHttp();

  const rows = await db
    .select({
      id: strike.id,
      reason: strike.reason,
      createdAt: strike.createdAt,
      senderId: strike.senderId,
      recipientId: strike.recipientId,
      revokedAt: strike.revokedAt,
      revokedById: strike.revokedById,
      revokeReason: strike.revokeReason,
      triggeredTermination: strike.triggeredTermination,
    })
    .from(strike)
    .where(kind === 'admin' ? undefined : eq(strike.senderId, actor.id))
    .orderBy(desc(strike.createdAt))
    .limit(limit);

  const names = await namesById(db, [
    ...rows.map((r) => r.senderId),
    ...rows.map((r) => r.recipientId),
    ...rows.flatMap((r) => (r.revokedById ? [r.revokedById] : [])),
  ]);

  return rows.map((r) => ({
    id: r.id,
    reason: r.reason,
    createdAt: r.createdAt,
    sender: { id: r.senderId, name: names.get(r.senderId) ?? null },
    recipient: { id: r.recipientId, name: names.get(r.recipientId) ?? null },
    revoked: !!r.revokedAt,
    revokedAt: r.revokedAt,
    revokedBy: r.revokedById ? { id: r.revokedById, name: names.get(r.revokedById) ?? null } : null,
    revokeReason: r.revokeReason,
    triggeredTermination: r.triggeredTermination,
  }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type SendStrikeResult = {
  strikeId: string;
  recipient: { id: number; name: string | null; email: string; emailNotifications: boolean };
  sender: { id: number; name: string | null };
  reason: string;
  activeCount: number;
  terminated: boolean;
};

/**
 * Inserts a strike and — if it is the recipient's 3rd active one — terminates
 * the account, all in one transaction. The recipient row is locked
 * (SELECT ... FOR UPDATE) so two simultaneous strikes can't both read "2".
 * Needs the pooled driver: the HTTP driver cannot run interactive transactions.
 */
export async function sendStrike(params: {
  actor: StrikeActor & { name?: string | null };
  recipientId: number;
  reason: unknown;
}): Promise<SendStrikeResult> {
  const reason = validateReason(params.reason);
  const { actor, recipientId } = params;
  if (!Number.isInteger(recipientId)) throw new StrikeError('Invalid recipient', 400);

  const { db, closeDb } = getDbPool();
  try {
    return await db.transaction(async (tx) => {
      const [target] = await tx
        .select({
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          role: userTable.role,
          roles: userTable.roles,
          employeeStatus: userTable.employeeStatus,
          emailNotifications: userTable.emailNotifications,
        })
        .from(userTable)
        .where(eq(userTable.id, recipientId))
        .limit(1)
        .for('update');

      if (!target) throw new StrikeError('Recipient not found', 404);

      const rule = checkCanStrike(actor, { ...target, roles: (target.roles as string[] | null) ?? [] });
      if (!rule.ok) throw new StrikeError(rule.error, rule.status);

      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(strike)
        .where(and(eq(strike.recipientId, target.id), isNull(strike.revokedAt)));

      const activeCount = Number(count) + 1;
      const terminated = activeCount >= MAX_STRIKES;
      const strikeId = createId();

      await tx.insert(strike).values({
        id: strikeId,
        recipientId: target.id,
        senderId: actor.id,
        reason,
        triggeredTermination: terminated,
      });

      if (terminated) {
        await tx
          .update(userTable)
          .set({ employeeStatus: 'TERMINATED', updatedAt: new Date().toISOString() })
          .where(eq(userTable.id, target.id));
      }

      return {
        strikeId,
        recipient: {
          id: target.id,
          name: target.name,
          email: target.email,
          emailNotifications: target.emailNotifications,
        },
        sender: { id: actor.id, name: actor.name ?? null },
        reason,
        activeCount,
        terminated,
      };
    });
  } finally {
    await closeDb().catch(() => {});
  }
}

export type RevokeStrikeResult = {
  strikeId: string;
  recipientId: number;
  recipientName: string | null;
  activeCount: number;
  /** true when the account is still TERMINATED — reinstate it in User Management. */
  recipientStillTerminated: boolean;
};

/** Admin-only. The strike stays in history, flagged as revoked. */
export async function revokeStrike(params: {
  actor: StrikeActor;
  strikeId: string;
  reason?: unknown;
}): Promise<RevokeStrikeResult> {
  const { actor, strikeId } = params;
  if (!isAdminActor(actor) || !isActiveAccount(actor)) {
    throw new StrikeError('Only admins can revoke strikes', 403);
  }
  const revokeReason =
    typeof params.reason === 'string' && params.reason.trim()
      ? params.reason.trim().slice(0, MAX_REASON_LENGTH)
      : null;

  const db = getDbHttp();
  const now = new Date().toISOString();

  const [updated] = await db
    .update(strike)
    .set({ revokedAt: now, revokedById: actor.id, revokeReason })
    .where(and(eq(strike.id, strikeId), isNull(strike.revokedAt)))
    .returning({ id: strike.id, recipientId: strike.recipientId });

  if (!updated) {
    const [existing] = await db.select({ id: strike.id }).from(strike).where(eq(strike.id, strikeId)).limit(1);
    if (!existing) throw new StrikeError('Strike not found', 404);
    throw new StrikeError('This strike was already revoked', 409);
  }

  const [recipient] = await db
    .select({ name: userTable.name, employeeStatus: userTable.employeeStatus })
    .from(userTable)
    .where(eq(userTable.id, updated.recipientId))
    .limit(1);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(strike)
    .where(and(eq(strike.recipientId, updated.recipientId), isNull(strike.revokedAt)));

  return {
    strikeId: updated.id,
    recipientId: updated.recipientId,
    recipientName: recipient?.name ?? null,
    activeCount: Number(count),
    recipientStillTerminated: recipient?.employeeStatus === 'TERMINATED',
  };
}

// ---------------------------------------------------------------------------
// Notifications (call after the transaction commits; never throws)
// ---------------------------------------------------------------------------

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function strikeEmailHtml(r: SendStrikeResult) {
  const headline = r.terminated
    ? 'Your account has been terminated'
    : `You received a strike (${r.activeCount} of ${MAX_STRIKES})`;
  const lead = r.terminated
    ? `This was your ${MAX_STRIKES}rd strike, so your E8 account has been deactivated.`
    : r.activeCount === MAX_STRIKES - 1
      ? `You now have ${r.activeCount} of ${MAX_STRIKES} strikes. One more will terminate your account.`
      : `You now have ${r.activeCount} of ${MAX_STRIKES} strikes.`;
  const from = r.sender.name ? `Sent by ${esc(r.sender.name)}.` : '';

  return renderEmailShell({
    previewText: esc(headline),
    contentHtml: `
      <tr><td class="px" style="padding:28px 40px 4px 40px;font-family:Helvetica,Arial,sans-serif;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#8a8a91;">Strike notice</td></tr>
      <tr><td class="px" style="padding:0 40px 12px 40px;font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:bold;line-height:1.3;color:#0a0a0b;">${esc(headline)}</td></tr>
      <tr><td class="px" style="padding:0 40px 12px 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3f3f46;">${esc(lead)} ${from}</td></tr>
      <tr><td class="px" style="padding:0 40px 16px 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3f3f46;"><strong>Reason:</strong><br>${esc(r.reason).replace(/\n/g, '<br>')}</td></tr>
      ${
        r.terminated
          ? ''
          : `<tr><td class="px" style="padding:8px 40px 0 40px;"><a href="${BASE_URL}" style="display:inline-block;background:#0a0a0b;color:#ffffff;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;padding:12px 22px;border-radius:8px;">Open E8</a></td></tr>`
      }`,
  });
}

/**
 * In-app + Slack DM (via notifyUser) and an email to the recipient. On a
 * termination, every active admin is also notified. Failures are logged,
 * never thrown — the strike is already committed.
 */
export async function notifyStrikeSent(r: SendStrikeResult): Promise<void> {
  try {
    const who = r.recipient.name || r.recipient.email;
    const senderName = r.sender.name || 'a team member';

    await notifyUser({
      userId: r.recipient.id,
      type: 'strike_received',
      title: r.terminated
        ? 'Your account has been terminated'
        : `You received a strike (${r.activeCount}/${MAX_STRIKES})`,
      body: `From ${senderName}: ${r.reason}`,
      payload: { strikeId: r.strikeId, activeCount: r.activeCount, terminated: r.terminated },
    }).catch((e) => console.warn('[strikes] in-app notify failed:', e?.message || e));

    // Disciplinary notice: sent regardless of the recipient's email-notification preference.
    await sendRawEmail({
      to: r.recipient.email,
      subject: r.terminated
        ? 'Your E8 account has been terminated'
        : `You received a strike (${r.activeCount} of ${MAX_STRIKES})`,
      html: strikeEmailHtml(r),
    }).catch((e) => console.warn('[strikes] email failed:', e?.message || e));

    if (r.terminated) {
      const db = getDbHttp();
      const admins = await db
        .select({ id: userTable.id, role: userTable.role, roles: userTable.roles })
        .from(userTable)
        .where(or(isNull(userTable.employeeStatus), eq(userTable.employeeStatus, 'ACTIVE')));
      const adminIds = admins.filter((a) => isAdminActor({ id: a.id, role: a.role, roles: a.roles as string[] | null })).map((a) => a.id);

      await Promise.all(
        adminIds.map((id) =>
          notifyUser({
            userId: id,
            type: 'strike_termination',
            title: `${who} was terminated after a third strike`,
            body: `Latest strike from ${senderName}: ${r.reason}`,
            payload: { strikeId: r.strikeId, recipientId: r.recipient.id },
          }).catch((e) => console.warn('[strikes] admin notify failed:', e?.message || e)),
        ),
      );
    }
  } catch (err: any) {
    console.error('[strikes] notifyStrikeSent failed:', err?.message || err);
  }
}

export async function notifyStrikeRevoked(r: RevokeStrikeResult): Promise<void> {
  try {
    await notifyUser({
      userId: r.recipientId,
      type: 'strike_revoked',
      title: 'A strike was removed from your record',
      body: `You now have ${r.activeCount} of ${MAX_STRIKES} strikes.`,
      payload: { strikeId: r.strikeId, activeCount: r.activeCount },
    });
  } catch (err: any) {
    console.error('[strikes] notifyStrikeRevoked failed:', err?.message || err);
  }
}
