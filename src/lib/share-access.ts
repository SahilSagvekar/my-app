// Access control for shared files/folders (ShareableFile + ShareRecipient).
//
// A share link (shareToken) alone is never sufficient to view content —
// the requester's email must match an invited ShareRecipient row. There
// are two ways a request can prove that:
//
//   1. They're logged into the platform (authToken cookie) with a session
//      email that matches a recipient — no extra step needed.
//   2. They've completed the public email + OTP verification flow
//      (POST /api/shared/[shareToken]/verify-email then verify-otp),
//      which sets a short-lived, share-scoped signed cookie.
//
// Both GET /api/shared/file/[shareToken] and GET /api/shared/folder/[shareToken]
// call checkShareAccess() before returning any content.

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { shareRecipient } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

const SHARE_ACCESS_COOKIE_PREFIX = 'sa_';
const SHARE_ACCESS_EXPIRY = '30d';

function getCookie(req: NextRequest | Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Decodes the platform login session (authToken), if present. Returns the
 *  logged-in user's email, or null if not logged in / invalid token. */
export function getSessionEmail(req: NextRequest | Request): string | null {
  const token = getCookie(req, 'authToken');
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
    return decoded?.email || null;
  } catch {
    return null;
  }
}

/** Issues a share-scoped access token after a recipient completes email+OTP
 *  verification. Bound to this specific shareToken + email — it can't be
 *  reused on a different share. */
export function createShareAccessToken(shareToken: string, email: string): string {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return jwt.sign(
    { shareToken, email, purpose: 'share-access' },
    process.env.JWT_SECRET,
    { expiresIn: SHARE_ACCESS_EXPIRY }
  );
}

export function shareAccessCookieName(shareToken: string): string {
  return `${SHARE_ACCESS_COOKIE_PREFIX}${shareToken}`;
}

function verifyShareAccessCookie(req: NextRequest | Request, shareToken: string): string | null {
  const token = getCookie(req, shareAccessCookieName(shareToken));
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.purpose !== 'share-access' || decoded?.shareToken !== shareToken) return null;
    return decoded?.email || null;
  } catch {
    return null;
  }
}

export type ShareAccessResult =
  | { authorized: true; email: string }
  | { authorized: false; email: null };

/**
 * Gate for the two public share-consuming routes. `shareId` is the
 * ShareableFile.id (not the token) that owns the recipient list.
 */
export async function checkShareAccess(
  req: NextRequest | Request,
  shareToken: string,
  shareId: string
): Promise<ShareAccessResult> {
  const db = getDbHttp();

  const candidateEmail = getSessionEmail(req) || verifyShareAccessCookie(req, shareToken);
  if (!candidateEmail) return { authorized: false, email: null };

  const [recipient] = await db
    .select()
    .from(shareRecipient)
    .where(
      and(
        eq(shareRecipient.shareId, shareId),
        eq(shareRecipient.email, candidateEmail.toLowerCase())
      )
    )
    .limit(1);

  if (!recipient) return { authorized: false, email: null };

  return { authorized: true, email: candidateEmail.toLowerCase() };
}