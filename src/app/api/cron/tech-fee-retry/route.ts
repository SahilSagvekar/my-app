// src/app/api/cron/tech-fee-retry/route.ts
// Sweeps TechFeeFailure rows (Tech Fee lookups that failed even after the
// immediate retry in captureTechFeeFromCharge — see stripe.ts) and retries
// each one. This is the safety net: without it, a fee that failed twice in
// a row would just sit as a permanent failure record and never actually
// get billed. Runs on a schedule (see worker.ts/wrangler.toml) rather than
// being triggered by anything — failures can happen at any time.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { techFeeFailure } from '@/lib/db/schema';
import { and, eq, lt } from 'drizzle-orm';
import { getStripeFeeForCharge, addTechFeeForCustomer } from '@/lib/stripe';

// Stop auto-retrying after this many attempts — a charge whose fee never
// becomes available after 5 tries needs a human to look at it, not another
// robot retry. The row stays in the table (unresolved) as a visible flag.
const MAX_ATTEMPTS = 5;

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ') && process.env.CRON_SECRET) {
    if (authHeader.slice(7) === process.env.CRON_SECRET) return true;
  }
  const cookieHeader = req.headers.get('cookie');
  const match = cookieHeader?.match(/authToken=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.role?.toLowerCase() === 'admin';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDbHttp();
  const pending = await db.select().from(techFeeFailure).where(
    and(eq(techFeeFailure.resolved, false), lt(techFeeFailure.attempts, MAX_ATTEMPTS))
  );

  let resolved = 0;
  let stillFailing = 0;

  for (const row of pending) {
    const fee = await getStripeFeeForCharge(row.chargeId);

    if (fee !== null) {
      await addTechFeeForCustomer(row.stripeCustomerId, fee, row.sourceDescription);
      await db.update(techFeeFailure).set({
        resolved: true,
        resolvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(techFeeFailure.id, row.id));
      resolved++;
      console.log(`✅ [tech-fee-retry] Resolved charge ${row.chargeId} on retry sweep`);
    } else {
      await db.update(techFeeFailure).set({
        attempts: row.attempts + 1,
        lastError: 'Still no balance_transaction fee available',
        updatedAt: new Date().toISOString(),
      }).where(eq(techFeeFailure.id, row.id));
      stillFailing++;
    }
  }

  if (stillFailing > 0) {
    console.warn(`⚠️ [tech-fee-retry] ${stillFailing} charge(s) still failing after this sweep — check TechFeeFailure table`);
  }

  return NextResponse.json({
    checked: pending.length,
    resolved,
    stillFailing,
  });
}