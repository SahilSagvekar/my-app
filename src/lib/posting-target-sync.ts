// Keeps PostingTarget rows (what the Daily Posting Tracker reads) in sync with
// the platforms/type set on a client's Monthly Deliverables.
//
// Scope: Monthly Deliverables only. The tracker is about recurring daily/weekly
// targets; One-Off Deliverables are single bundles, not ongoing platform
// commitments, so they're intentionally left out of this sync.
//
// Snapchat is intentionally never touched here — it's still selectable on a
// deliverable, but the tracker's progress route explicitly excludes it
// ("Snapchat is no longer tracked"), so we don't create or delete Snapchat rows.

import { db } from "@/lib/db";
import { monthlyDeliverable, postingTarget } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { eq, inArray } from "drizzle-orm";
import { normalizeDeliverableType } from "@/lib/posting-match";

// Facebook is historically tracked as up to three separate destinations in
// PostingTarget (FB Profile / FB Page / FB TV) — a deliverable can't say which
// one it means, it just says "Facebook". So:
//  - if Facebook is removed from a deliverable, we clear ALL of these for the client
//  - if Facebook is newly added, we create a single generic "Facebook" row
const FACEBOOK_TARGET_NAMES = ["FB Profile", "FB Page", "FB TV", "Facebook"];

// Deliverable platform -> generic key used to detect whether a given
// PostingTarget row belongs to that platform.
function genericPlatformForTargetName(targetName: string): string | null {
  const p = targetName.toLowerCase();
  if (p.includes("ig") || p.includes("instagram")) return "Instagram";
  if (p.includes("fb") || p.includes("facebook")) return "Facebook";
  if (p === "tt" || p.includes("tiktok")) return "TikTok";
  if (p === "yt" || p.includes("youtube")) return "YouTube";
  if (p === "li" || p.includes("linkedin")) return "LinkedIn";
  if (p.includes("twitter") || p === "x") return "Twitter";
  if (p.includes("snap")) return "Snapchat";
  return null;
}

// The single PostingTarget platform name to create when a generic platform is
// newly added to a deliverable and nothing for it exists yet.
function defaultTargetNameForCreate(genericPlatform: string): string {
  if (genericPlatform === "Facebook") return "Facebook";
  if (genericPlatform === "Instagram") return "IG";
  if (genericPlatform === "TikTok") return "TT";
  if (genericPlatform === "YouTube") return "YT";
  if (genericPlatform === "LinkedIn") return "LI";
  return genericPlatform; // Twitter, or anything unrecognized — use as-is
}

/**
 * Re-derives the set of (platform, deliverableType) pairs that SHOULD be
 * tracked for this client from its Monthly Deliverables, then:
 *  - deletes PostingTarget rows for pairs no longer present on any deliverable
 *  - creates PostingTarget rows for newly-added pairs that don't exist yet
 *  - leaves untouched any existing row that still matches a desired pair
 *    (preserves manually-tuned count/frequency/extras)
 *
 * Snapchat is skipped entirely in both directions.
 */
export async function syncPostingTargetsForClient(clientId: string): Promise<void> {
  if (!clientId) {
    // Fail loudly rather than run any query below unscoped across ALL clients.
    throw new Error("syncPostingTargetsForClient: clientId is required");
  }

  const [deliverables, existingTargets] = await Promise.all([
    db.select({ type: monthlyDeliverable.type, platforms: monthlyDeliverable.platforms })
      .from(monthlyDeliverable).where(eq(monthlyDeliverable.clientId, clientId)),
    db.select({ id: postingTarget.id, platform: postingTarget.platform, deliverableType: postingTarget.deliverableType })
      .from(postingTarget).where(eq(postingTarget.clientId, clientId)),
  ]);

  // Desired set: "GenericPlatform::TYPE" -> true
  const desired = new Set<string>();
  for (const d of deliverables) {
    const normType = normalizeDeliverableType(d.type);
    for (const platform of (d.platforms ?? [])) {
      if (platform === "Snapchat") continue; // never synced
      desired.add(`${platform}::${normType}`);
    }
  }

  // Which desired pairs are already covered by an existing row?
  const covered = new Set<string>();
  const toDelete: string[] = [];

  for (const row of existingTargets) {
    const generic = genericPlatformForTargetName(row.platform);
    if (!generic || generic === "Snapchat") continue; // leave unrecognized/Snapchat rows alone

    const normType = normalizeDeliverableType(row.deliverableType);
    const key = `${generic}::${normType}`;

    if (desired.has(key)) {
      covered.add(key);
    } else {
      toDelete.push(row.id);
    }
  }

  const toCreate: { clientId: string; platform: string; deliverableType: string }[] = [];
  for (const key of desired) {
    if (covered.has(key)) continue;
    const [generic, type] = key.split("::");
    toCreate.push({
      clientId,
      platform: defaultTargetNameForCreate(generic),
      deliverableType: type,
    });
  }

  const batchOps = [
    ...(toDelete.length
      ? [db.delete(postingTarget).where(inArray(postingTarget.id, toDelete))]
      : []),
    ...toCreate.map((t) =>
      db.insert(postingTarget).values({
        id: createId(),
        clientId: t.clientId,
        platform: t.platform,
        deliverableType: t.deliverableType,
        count: 1,
        frequency: "daily",
        updatedAt: new Date().toISOString(),
      }).onConflictDoNothing({
        target: [postingTarget.clientId, postingTarget.platform, postingTarget.deliverableType],
      })
    ),
  ];

  if (batchOps.length > 0) {
    await db.batch(batchOps as any);
  }
}