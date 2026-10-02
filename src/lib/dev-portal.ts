// src/lib/dev-portal.ts
//
// Shared constants + auth for the Dev Portal (internal/client problem
// reports as a prioritised task list).
import type { NextRequest } from "next/server";
import { getJwtUserId, getUserFromToken } from "@/lib/auth-helpers";

import { DEV_PORTAL_EMAILS, isDevPortalEmail } from "@/lib/dev-portal-access";

// Re-exported so server code has one import; the list itself lives in a
// client-safe file shared with ViewAsRoleContext.
export { DEV_PORTAL_EMAILS, isDevPortalEmail };

export const TICKET_TYPES = ["BUG", "REQUEST", "IMPROVEMENT", "QUESTION"] as const;
export const TICKET_PRIORITIES = ["UNSET", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "WONT_FIX"] as const;

export type TicketType = (typeof TICKET_TYPES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

// Higher = more urgent. UNSET sorts just above LOW so un-triaged items
// surface for Eric instead of sinking to the bottom.
export const PRIORITY_RANK: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, UNSET: 1.5, LOW: 1 };

export interface DevPortalAuth {
  userId: number;
  email: string;
  role: string;
  /** Can open the portal and see the full ticket list. */
  hasPortal: boolean;
  /** Can set priority, assign, change status, delete (admins with portal access). */
  canTriage: boolean;
}

export function getDevPortalAuth(req: NextRequest): DevPortalAuth | null {
  const u = getUserFromToken(req);
  const userId = getJwtUserId(u);
  if (!u || !userId) return null;
  const email = (u.email || "").trim().toLowerCase();
  const role = (u.role || "").toLowerCase();
  const hasPortal = isDevPortalEmail(email);
  return { userId, email, role, hasPortal, canTriage: hasPortal && role === "admin" };
}

export const MAX_SCREENSHOT_BYTES = 15 * 1024 * 1024;
export const LOOM_URL_RE = /^https:\/\/(www\.)?loom\.com\/(share|embed)\/[A-Za-z0-9]+/i;
