import { prisma } from '@/lib/prisma';

// Singleton config row (first row wins) — minimum payout threshold and
// hold window are admin-tunable without a code deploy.
export async function getPayoutConfig() {
  const existing = await prisma.payoutConfig.findFirst();
  if (existing) return existing;

  return prisma.payoutConfig.create({
    data: { minimumThresholdCents: 2500, holdWindowDays: 14 },
  });
}
