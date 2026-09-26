// Shared helpers for the Host Portal (talent-facing portal — see
// design_handoff_host_portal/README.md). A "host" is a User with role `host`
// who is booked onto shoots via ShootDetail.hostId (one host per shoot).

import { getDbHttp } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const HOST_ROLE = 'host';

type RoleLike = { role?: string | null; roles?: (string | null)[] | null };

/** True for an account whose primary role or any extra role is `host`. */
export function hasHostRole(u: RoleLike | null | undefined): boolean {
  if (!u) return false;
  if ((u.role || '').toLowerCase() === HOST_ROLE) return true;
  return Array.isArray(u.roles) && u.roles.some((r) => (r || '').toLowerCase() === HOST_ROLE);
}

/** Roles that may see any host's data (support / admin preview of the portal). */
export function canViewAllHosts(u: RoleLike | null | undefined): boolean {
  const role = (u?.role || '').toLowerCase();
  return role === 'admin' || role === 'manager';
}

/**
 * Only admins and managers may see or set a host's rate. Videographers can create/edit
 * shoots (and pick the host) but never touch what the host is paid — enforced on the
 * server, not just hidden in the form.
 */
export function canManageHostRate(u: RoleLike | null | undefined): boolean {
  return canViewAllHosts(u);
}

export interface HostUser {
  id: number;
  name: string | null;
  email: string;
}

/** Loads a user by id and returns it only if it is actually a host. */
export async function getHostUser(id: number): Promise<HostUser | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  const db = getDbHttp();
  const [u] = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email, role: userTable.role, roles: userTable.roles })
    .from(userTable)
    .where(eq(userTable.id, id))
    .limit(1);
  if (!u || !hasHostRole(u as RoleLike)) return null;
  return { id: u.id, name: u.name, email: u.email };
}

/** Normalises a rate from a form ("", null, "450", 450) to a numeric-column value. */
export function parseHostRate(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined; // not provided — leave the column alone
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n.toFixed(2);
}
