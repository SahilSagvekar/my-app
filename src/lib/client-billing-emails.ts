import { prisma } from '@/lib/prisma';

/**
 * Collect every email that should receive billing/invoice mail for a client:
 * - Client.email
 * - Client.emails[]
 * - Primary linked User (Client.userId)
 * - Users with linkedClientId pointing at this client
 */
export async function getClientBillingEmails(clientId: string): Promise<string[]> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      email: true,
      emails: true,
      user: { select: { email: true, emailNotifications: true } },
      linkedUsers: {
        select: { email: true, emailNotifications: true },
      },
    },
  });

  if (!client) return [];

  const emails = new Set<string>();

  const add = (email: string | null | undefined, notificationsEnabled = true) => {
    if (!email || !notificationsEnabled) return;
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) return;
    emails.add(normalized);
  };

  add(client.email);
  for (const e of client.emails || []) add(e);

  if (client.user) {
    add(client.user.email, client.user.emailNotifications !== false);
  }

  for (const user of client.linkedUsers || []) {
    add(user.email, user.emailNotifications !== false);
  }

  return Array.from(emails);
}
