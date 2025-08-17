import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function sendNotification(userId: string, message: string) {
  return prisma.notification.create({
    data: {
      userId,
      message,
    },
  });
}
