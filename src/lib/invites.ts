// src/lib/invites.ts
//
// Shared helpers for the "invite a new user by email" flow. The raw token
// only ever exists in the emailed link; the DB stores its SHA-256 hash, so a
// leaked DB row can't be turned into a working signup link.

export const INVITE_TTL_DAYS = 7;

// Staff roles an admin can invite. "client" is intentionally excluded:
// clients need a Client record + portal provisioning (PreClient -> Quote ->
// provision()), not just a role on a User row.
export const INVITABLE_ROLES = [
  "admin",
  "manager",
  "editor",
  "videographer",
  "scheduler",
  "qc",
  "sales",
  "sales_manager",
  "host",
] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(r: unknown): r is InvitableRole {
  return typeof r === "string" && (INVITABLE_ROLES as readonly string[]).includes(r);
}

export function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashInviteToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function inviteExpiryIso(): string {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function buildInviteUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://app.e8productions.com";
  return `${base.replace(/\/$/, "")}/register?invite=${token}`;
}
