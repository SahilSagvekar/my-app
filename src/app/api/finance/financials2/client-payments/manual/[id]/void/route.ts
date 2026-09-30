export const dynamic = 'force-dynamic';

// POST /api/finance/financials2/client-payments/manual/:id/void
// Body: { reason?: string }
// Voids a manual payment (never hard-deletes) so it drops out of revenue but
// stays visible for the audit trail. Admin only.

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { clientManualPayment as manualTable } from '@/lib/db/schema';
import { getJwtUserId, getUserFromToken, requireAdmin } from '@/lib/auth-helpers';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    const adminCheck = requireAdmin(currentUser);
    if (adminCheck || !currentUser) {
      return NextResponse.json({ ok: false, message: adminCheck?.error ?? 'Unauthorized' }, { status: adminCheck?.status ?? 401 });
    }

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;

    const [existing] = await db
      .select({ id: manualTable.id, voidedAt: manualTable.voidedAt })
      .from(manualTable)
      .where(eq(manualTable.id, id))
      .limit(1);
    if (!existing) return NextResponse.json({ ok: false, message: 'Payment not found' }, { status: 404 });
    if (existing.voidedAt) return NextResponse.json({ ok: false, message: 'Payment is already voided' }, { status: 409 });

    const now = new Date().toISOString();
    await db
      .update(manualTable)
      .set({ voidedAt: now, voidedById: getJwtUserId(currentUser), voidReason: reason, updatedAt: now })
      .where(eq(manualTable.id, id));

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[financials2/client-payments/manual void]', err);
    return NextResponse.json({ ok: false, message: err.message || 'Server error' }, { status: 500 });
  }
}
