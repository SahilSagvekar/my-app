// Day-before internal review reminder for auto-invoice (Option 1).
// Finds clients whose nextBillingDate is tomorrow and notifies Eric/admins
// with planned invoice details. Does NOT create invoices or block sending.

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDbHttp } from '@/lib/db';
import { clientPortalAccess as clientPortalAccessTable } from '@/lib/db/schema';
import { and, eq, gt, isNotNull } from 'drizzle-orm';
import { toDateInputValue } from '@/lib/auto-invoice';
import {
  notifyAutoInvoiceReviewReminder,
  type AutoInvoiceReviewItem,
} from '@/lib/auto-invoice-review-notifications';

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

/** Tomorrow's calendar date in America/New_York as YYYY-MM-DD. */
function tomorrowEtYmd(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA gives YYYY-MM-DD
  const partsNow = fmt.formatToParts(new Date());
  const y = Number(partsNow.find((p) => p.type === 'year')?.value);
  const m = Number(partsNow.find((p) => p.type === 'month')?.value);
  const d = Number(partsNow.find((p) => p.type === 'day')?.value);
  // Construct noon UTC on that ET calendar day, then add 1 calendar day in ET
  // by formatting a Date shifted +24h from a stable ET anchor.
  const anchor = new Date(Date.UTC(y, m - 1, d, 16, 0, 0)); // ~noon ET during EDT
  const tomorrow = new Date(anchor.getTime() + 24 * 60 * 60 * 1000);
  return fmt.format(tomorrow);
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const db = getDbHttp();
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tomorrow = tomorrowEtYmd();

    const active = await db.query.clientPortalAccess.findMany({
      where: and(
        eq(clientPortalAccessTable.autoInvoiceActive, true),
        isNotNull(clientPortalAccessTable.nextBillingDate),
        isNotNull(clientPortalAccessTable.recurringAmount),
        gt(clientPortalAccessTable.recurringAmount, 0),
      ),
      with: { client: true },
    });

    const items: AutoInvoiceReviewItem[] = [];
    for (const access of active) {
      const billingYmd = toDateInputValue(access.nextBillingDate);
      if (billingYmd !== tomorrow) continue;
      const client = access.client;
      items.push({
        clientId: client.id,
        clientName: client.companyName || client.name,
        email: client.email,
        amountCents: access.recurringAmount!,
        description: access.recurringDescription || 'Monthly retainer',
        dueDays: access.dueDays ?? 15,
        nextBillingDate: access.nextBillingDate!,
      });
    }

    items.sort((a, b) => a.clientName.localeCompare(b.clientName));

    if (items.length === 0) {
      return NextResponse.json({
        ok: true,
        message: `No auto-invoices scheduled for tomorrow (${tomorrow})`,
        tomorrow,
        count: 0,
        items: [],
      });
    }

    const notifyResult = await notifyAutoInvoiceReviewReminder(items);

    return NextResponse.json({
      ok: true,
      message: `Notified review for ${items.length} invoice(s) sending ${tomorrow}`,
      tomorrow,
      count: items.length,
      items,
      notifyResult,
    });
  } catch (err: any) {
    console.error('[auto-invoice-review-reminder] Fatal error:', err);
    return NextResponse.json({ ok: false, message: err.message }, { status: 500 });
  }
}
