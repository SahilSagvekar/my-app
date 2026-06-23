export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendBillingWarningEmail } from '@/app/api/stripe/webhook/route';

// GET /api/cron/billing-warnings
// Runs daily at 10 AM — sends warning emails to clients whose billing date is in 3 days
export async function GET(req: NextRequest) {
  try {
    const now = new Date();

    // Target: clients whose next billing date is exactly 3 days from now
    const warningDate = new Date(now);
    warningDate.setDate(warningDate.getDate() + 3);
    warningDate.setHours(0, 0, 0, 0);

    const warningDateEnd = new Date(warningDate);
    warningDateEnd.setHours(23, 59, 59, 999);

    const dueAccesses = await prisma.clientPortalAccess.findMany({
      where: {
        status: 'ACTIVE',
        nextBillingDate: {
          gte: warningDate,
          lte: warningDateEnd,
        },
      },
      include: {
        client: {
          select: { id: true, name: true, email: true, companyName: true },
        },
      },
    });

    console.log(`[Billing Warnings] Found ${dueAccesses.length} clients due in 3 days`);

    const results = await Promise.allSettled(
      dueAccesses.map(async (access) => {
        const client = access.client;
        await sendBillingWarningEmail(
          client.companyName || client.name,
          client.email,
          access.nextBillingDate!
        );
        console.log(`📧 [Billing Warning] Sent to ${client.email}`);
        return client.id;
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      ok: true,
      processed: dueAccesses.length,
      sent,
      failed,
    });
  } catch (err: any) {
    console.error('[Billing Warnings Cron] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
