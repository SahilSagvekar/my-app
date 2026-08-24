/**
 * Shared helpers for the auto-invoice / portal-billing schedule.
 * Keeps nextBillingDate ownership clear: only auto-invoice (and explicit
 * admin edits) advance the schedule when autoInvoiceActive is on.
 */

/** Advance one calendar month without drifting past month-end (Jan 31 → Feb 28). */
export function advanceOneCalendarMonth(from: Date | string): Date {
  const source = typeof from === 'string' ? new Date(from) : new Date(from.getTime());
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const hours = source.getUTCHours();
  const minutes = source.getUTCMinutes();
  const seconds = source.getUTCSeconds();
  const ms = source.getUTCMilliseconds();

  const targetMonthIndex = month + 1;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTarget);

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay, hours, minutes, seconds, ms));
}

/** Date input value (YYYY-MM-DD) from an ISO timestamp using UTC calendar day. */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Store date-input as noon UTC so US timezones don't shift the calendar day. */
export function fromDateInputValue(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

/**
 * Portal unlock fields after a successful payment.
 * When auto-invoice owns the schedule, do NOT rewrite nextBillingDate.
 */
export function portalUnlockUpdate(opts: {
  autoInvoiceActive: boolean;
  existingNextBillingDate: string | null | undefined;
  billingAnchorDate: string | null | undefined;
  now?: Date;
}): Record<string, unknown> {
  const now = opts.now ?? new Date();
  const update: Record<string, unknown> = {
    status: 'ACTIVE',
    lockedAt: null,
    adminUnlockedById: null,
    adminUnlockedAt: null,
    updatedAt: now.toISOString(),
  };

  if (!opts.billingAnchorDate) {
    update.billingAnchorDate = now.toISOString();
  }

  // Auto-invoice already advanced nextBillingDate when the invoice was created.
  // Only set/refresh the schedule for clients not on auto-invoice.
  if (!opts.autoInvoiceActive) {
    if (opts.existingNextBillingDate) {
      // Leave existing schedule alone if present and not on auto-invoice —
      // still refresh from "now + 1 month" for legacy subscription unlocks
      // that expect a rolling window after pay.
      update.nextBillingDate = advanceOneCalendarMonth(now).toISOString();
    } else {
      update.nextBillingDate = advanceOneCalendarMonth(now).toISOString();
    }
  }

  return update;
}
