import { prisma } from '@/lib/prisma';

export async function sendNotification(userId: string, message: string) {
  return prisma.notification.create({
    data: {
      userId,
      message,
    },
  });
}
