// src/lib/drive/access.ts
//
// Who can see which part of Files & Drive. One place for the rules that
// /api/drive/structure used to apply inline, reused by search, recent,
// starred, trash, previews and activity.
//
// SECURITY NOTE: /api/drive/structure and /api/drive/search used to read
// `role` and `userId` straight from the query string with no login check
// at all — anyone could call `?role=client&userId=5` (or `role=admin`) and
// get a client's full file tree with 7-day presigned links. Everything now
// resolves from the logged-in user. `role` from the query is only honored
// if the user actually holds it (primary role, a secondary role, or admin
// previewing another portal); otherwise we fall back to their real role.

import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import {
  client as clientTable,
  user as userTable,
  editorClientPermission,
  task as taskTable,
} from '@/lib/db/schema';

type Db = ReturnType<typeof getDbHttp>;
type AppUser = typeof userTable.$inferSelect;

/** Roles that can browse every client's Drive (they pick a client first). */
export const ALL_CLIENT_ROLES = new Set(['admin', 'manager', 'scheduler', 'videographer']);

export interface DriveScope {
  /** The role the request is effectively acting as. */
  role: string;
  /** null = every client; otherwise the client folder prefixes ("Acme/") this user may see. */
  allowedPrefixes: string[] | null;
  /** The single client folder being browsed right now ('' = none selected yet). */
  prefix: string;
}

export function userHoldsRole(user: AppUser, role: string): boolean {
  if (!role) return false;
  if (user.role === role) return true;
  if (user.role === 'admin') return true; // admins preview every portal
  return Array.isArray(user.roles) && (user.roles as string[]).includes(role);
}

function companyFolder(row: { companyName: string | null; name: string } | null | undefined): string | null {
  const name = row?.companyName || row?.name;
  return name ? `${name}/` : null;
}

async function clientPrefixById(db: Db, clientId: string): Promise<string | null> {
  const [row] = await db
    .select({ companyName: clientTable.companyName, name: clientTable.name })
    .from(clientTable)
    .where(eq(clientTable.id, clientId))
    .limit(1);
  return companyFolder(row);
}

/** A client user's own company folder (linked client, email match, or Client.userId). */
async function ownClientPrefix(db: Db, user: AppUser): Promise<string | null> {
  if (user.linkedClientId) {
    const p = await clientPrefixById(db, user.linkedClientId);
    if (p) return p;
  }
  const [byEmail] = await db
    .select({ companyName: clientTable.companyName, name: clientTable.name })
    .from(clientTable)
    .where(eq(clientTable.email, user.email))
    .limit(1);
  if (byEmail) return companyFolder(byEmail);
  const [byUserId] = await db
    .select({ companyName: clientTable.companyName, name: clientTable.name })
    .from(clientTable)
    .where(eq(clientTable.userId, user.id))
    .limit(1);
  return companyFolder(byUserId);
}

/** Company folders an editor may browse: explicit permissions + clients of tasks assigned to them. */
async function editorPrefixes(db: Db, editorId: number): Promise<{ prefixes: string[]; clientIds: Set<string> }> {
  const perms = await db
    .select({ clientId: editorClientPermission.clientId })
    .from(editorClientPermission)
    .where(eq(editorClientPermission.editorId, editorId));
  const tasks = await db
    .selectDistinct({ clientId: taskTable.clientId })
    .from(taskTable)
    .where(and(eq(taskTable.assignedTo, editorId), isNotNull(taskTable.clientId)));

  const clientIds = new Set<string>([
    ...perms.map((p) => p.clientId),
    ...tasks.map((t) => t.clientId).filter((id): id is string => !!id),
  ]);
  if (clientIds.size === 0) return { prefixes: [], clientIds };

  const rows = await db
    .select({ companyName: clientTable.companyName, name: clientTable.name })
    .from(clientTable)
    .where(inArray(clientTable.id, [...clientIds]));
  const prefixes = [...new Set(rows.map(companyFolder).filter((p): p is string => !!p))];
  return { prefixes, clientIds };
}

/**
 * Resolve what the current request may see.
 * @param requestedRole  the portal role the UI is acting as (?role=), validated here
 * @param clientId       the client picked in the UI (?clientId=), validated here
 */
export async function resolveDriveScope(
  user: AppUser,
  requestedRole?: string | null,
  clientId?: string | null,
): Promise<DriveScope> {
  const db = getDbHttp();
  const role = requestedRole && userHoldsRole(user, requestedRole) ? requestedRole : user.role;
  const cleanClientId =
    clientId && !/^\[object /i.test(clientId) && clientId !== 'undefined' && clientId !== 'null' ? clientId : null;

  if (ALL_CLIENT_ROLES.has(role)) {
    const prefix = cleanClientId ? (await clientPrefixById(db, cleanClientId)) || '' : '';
    return { role, allowedPrefixes: null, prefix };
  }

  if (role === 'client') {
    // A real client user only ever sees their own company. Staff previewing
    // the client portal (admin/manager via "view as client") may name the
    // client they're previewing.
    let prefix: string | null = null;
    if (cleanClientId && ALL_CLIENT_ROLES.has(user.role)) {
      prefix = await clientPrefixById(db, cleanClientId);
    } else {
      prefix = await ownClientPrefix(db, user);
    }
    return { role, allowedPrefixes: prefix ? [prefix] : [], prefix: prefix || '' };
  }

  if (role === 'editor') {
    const { prefixes, clientIds } = await editorPrefixes(db, user.id);
    let prefix = '';
    if (cleanClientId) {
      if (clientIds.has(cleanClientId)) prefix = (await clientPrefixById(db, cleanClientId)) || '';
    } else if (prefixes.length === 1) {
      prefix = prefixes[0]; // only one client — auto-scope, same as before
    }
    return { role, allowedPrefixes: prefixes, prefix };
  }

  // qc, sales, etc. have no Drive access (same as before — they got an empty root).
  return { role, allowedPrefixes: [], prefix: '' };
}

export function scopeAllowsKey(scope: DriveScope, key: string): boolean {
  if (scope.allowedPrefixes === null) return true;
  return scope.allowedPrefixes.some((p) => key.startsWith(p));
}

/**
 * Same rules as the old /api/drive/delete route: editors can't delete;
 * clients only inside their own raw-footage deliverable folders (depth 3+).
 */
export function canDeleteKey(scope: DriveScope, key: string): { ok: true } | { ok: false; error: string } {
  if (scope.role === 'editor') return { ok: false, error: 'Editors cannot delete files' };
  if (!scopeAllowsKey(scope, key)) return { ok: false, error: 'You can only delete items in your own folder' };
  if (scope.role === 'client') {
    if (!key.includes('raw-footage')) return { ok: false, error: 'You can only delete items in your raw footage folder' };
    const parts = key.split('/').filter(Boolean);
    const rf = parts.indexOf('raw-footage');
    const depth = rf >= 0 ? parts.length - rf - 1 : -1;
    if (depth < 3) return { ok: false, error: 'You can only delete items inside your deliverable folders' };
  }
  if (!ALL_CLIENT_ROLES.has(scope.role) && scope.role !== 'client') {
    return { ok: false, error: 'Not allowed' };
  }
  return { ok: true };
}

/**
 * Can this user see `key` under ANY portal role they hold? Used where a
 * request carries only a session (no signed Drive token), e.g. an expired
 * link in a long-open tab or the NAS download proxy.
 */
export async function userCanAccessKey(user: AppUser, key: string): Promise<boolean> {
  const roles = new Set<string>([user.role, ...((user.roles as string[] | null) || [])]);
  if ([...roles].some((r) => ALL_CLIENT_ROLES.has(r))) return true;
  for (const r of roles) {
    const scope = await resolveDriveScope(user, r);
    if (scopeAllowsKey(scope, key) && scope.allowedPrefixes && scope.allowedPrefixes.length) return true;
  }
  return false;
}
