import { prisma } from '@/lib/prisma';

export async function createNotification(
  userId: number,
  type: string,
  title: string,
  body: string,
  payload?: any
) {
  try {
    // Create in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        payload,
        channel: ['in-app']
      }
    });

    // Send via Socket.io
    const io = (global as any).io;
    if (io) {
      io.to(`user:${userId}`).emit('notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}