import { prisma } from '@/lib/prisma';

export const DEFAULT_COMMISSION_RATE = 0.15;

// Singleton config row (first row wins) — minimum payout threshold and
// hold window are admin-tunable without a code deploy.
export async function getPayoutConfig() {
  const existing = await prisma.payoutConfig.findFirst();
  if (existing) return existing;

  return prisma.payoutConfig.create({
    data: { minimumThresholdCents: 2500, holdWindowDays: 5 },
  });
}

// Per-rep commission % override, set by admin on SalesRepPayoutProfile.
// Falls back to the platform default when the rep has no override set.
export async function getCommissionRateForUser(userId: number): Promise<number> {
  const profile = await prisma.salesRepPayoutProfile.findUnique({
    where: { userId },
    select: { commissionRate: true },
  });
  return profile?.commissionRate != null ? Number(profile.commissionRate) : DEFAULT_COMMISSION_RATE;
}
