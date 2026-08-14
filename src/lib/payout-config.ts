import { getDb } from '@/lib/db';
import { payoutConfig, salesRepPayoutProfile } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { eq } from 'drizzle-orm';

export const DEFAULT_COMMISSION_RATE = 0.15;

// Singleton config row (first row wins) — minimum payout threshold and
// hold window are admin-tunable without a code deploy.
export async function getPayoutConfig() {
  const { db, closeDb } = getDb();
  try {
  const [existing] = await db.select().from(payoutConfig).limit(1);
  if (existing) return existing;

  const [created] = await db.insert(payoutConfig).values({
    id: createId(),
    minimumThresholdCents: 2500,
    holdWindowDays: 5,
    updatedAt: new Date().toISOString(),
  }).returning();
  return created;

  } finally {
    await closeDb();
  }
}

// Per-rep commission % override, set by admin on SalesRepPayoutProfile.
// Falls back to the platform default when the rep has no override set.
export async function getCommissionRateForUser(userId: number): Promise<number> {
  const { db, closeDb } = getDb();
  try {
  const [profile] = await db
    .select({ commissionRate: salesRepPayoutProfile.commissionRate })
    .from(salesRepPayoutProfile)
    .where(eq(salesRepPayoutProfile.userId, userId))
    .limit(1);
  return profile?.commissionRate != null ? Number(profile.commissionRate) : DEFAULT_COMMISSION_RATE;

  } finally {
    await closeDb();
  }
}
