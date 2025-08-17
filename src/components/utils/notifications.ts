import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
