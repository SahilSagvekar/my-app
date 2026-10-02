// src/lib/dev-portal-access.ts
//
// Client-safe (no server imports) so ViewAsRoleContext can use it. Emails that
// get the Dev Portal in their portal switcher.
export const DEV_PORTAL_EMAILS = ["eric@e8productions.com", "sahilsagvekar230@gmail.com"];

export const isDevPortalEmail = (email?: string | null) =>
  !!email && DEV_PORTAL_EMAILS.includes(email.trim().toLowerCase());
