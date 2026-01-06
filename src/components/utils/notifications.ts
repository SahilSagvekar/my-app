import { prisma } from '@/lib/prisma';

export async function sendNotification(userId: string, message: string) {
  await prisma.notification.create({
    data: {
      userId,
      message,
      read: false,
      createdAt: new Date(),
    },
  });

  // Optionally, push via email or websocket
}
