// src/lib/share-review-link.ts
//
// Public, no-login "review this deliverable" links for clients — reuses
// or mints a ShareableReview token and points at /shared/review/[shareToken]
// (see that page + /api/tasks/[id]/status's shareToken bypass). Used by the
// client-facing review-notification emails so clicking the email button
// skips sign-in entirely, instead of landing on the bare dashboard and
// forcing a login. Mirrors the manual "Share" button's
// POST /api/tasks/[id]/share, just without a staff JWT to attribute it to.

import { getDbHttp } from './db';
import { shareableReview } from './db/schema';
import { createId } from './db/id';
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { randomBytes } from 'crypto';

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.e8productions.com';
}

/**
 * Returns the review URL for a task, reusing an existing active
 * (non-expired) ShareableReview token if one exists, or creating one.
 * `createdBy` is just an attribution field (no FK) — pass the staff user
 * who triggered the notification when known, or omit it for
 * system/cron-generated links.
 */
export async function getOrCreateReviewShareUrl(taskId: string, createdBy: number = 0): Promise<string> {
  const db = getDbHttp();

  const [existing] = await db
    .select({ shareToken: shareableReview.shareToken })
    .from(shareableReview)
    .where(
      and(
        eq(shareableReview.taskId, taskId),
        eq(shareableReview.isActive, true),
        or(isNull(shareableReview.expiresAt), gt(shareableReview.expiresAt, new Date().toISOString()))
      )
    )
    .orderBy(desc(shareableReview.createdAt))
    .limit(1);

  if (existing) {
    return `${baseUrl()}/shared/review/${existing.shareToken}`;
  }

  const shareToken = randomBytes(32).toString('hex');
  await db.insert(shareableReview).values({
    id: createId(),
    taskId,
    shareToken,
    createdBy,
    isActive: true,
    updatedAt: new Date().toISOString(),
  });

  return `${baseUrl()}/shared/review/${shareToken}`;
}
