import { getClientBillingEmails } from '@/lib/client-billing-emails';
import { sendClientInvoiceEmails } from '@/lib/email';

type NotifyInvoiceArgs = {
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  amountCents: number;
  currency?: string;
  dueDate?: Date | null;
  invoiceUrl?: string | null;
  pdfUrl?: string | null;
  description?: string | null;
  /** Email that already received Stripe's native invoice email */
  stripeCustomerEmail?: string | null;
};

/**
 * Email every billing contact for a client about a sent invoice.
 * Skips the Stripe customer email so that address isn't double-notified.
 */
export async function notifyAllClientInvoiceEmails(args: NotifyInvoiceArgs) {
  try {
    const emails = await getClientBillingEmails(args.clientId);
    if (emails.length === 0) {
      console.warn(`[Invoice notify] No billing emails found for client ${args.clientId}`);
      return { sent: [] as string[], skipped: [] as string[] };
    }

    return await sendClientInvoiceEmails({
      to: emails,
      excludeEmails: args.stripeCustomerEmail ? [args.stripeCustomerEmail] : [],
      clientName: args.clientName,
      invoiceNumber: args.invoiceNumber,
      amountCents: args.amountCents,
      currency: args.currency,
      dueDate: args.dueDate,
      invoiceUrl: args.invoiceUrl,
      pdfUrl: args.pdfUrl,
      description: args.description,
    });
  } catch (err) {
    console.error('[Invoice notify] Failed to fan-out invoice emails:', err);
    return { sent: [] as string[], skipped: [] as string[] };
  }
}
