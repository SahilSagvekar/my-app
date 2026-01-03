import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  keepAliveInterval: NodeJS.Timeout | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Store in global for both dev AND production
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;

  // ✅ Keepalive: Ping the database every 4 minutes to prevent connection timeout
  // Most cloud databases close idle connections after 5-10 minutes
  if (typeof globalForPrisma.keepAliveInterval === 'undefined') {
    globalForPrisma.keepAliveInterval = setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        if (process.env.NODE_ENV === 'development') {
          console.log('[Prisma] Keepalive ping successful');
        }
      } catch (error) {
        console.error('[Prisma] Keepalive ping failed, attempting reconnect...');
        try {
          await prisma.$disconnect();
          await prisma.$connect();
          console.log('[Prisma] Reconnected successfully');
        } catch (reconnectError) {
          console.error('[Prisma] Reconnection failed:', reconnectError);
        }
      }
    }, 4 * 60 * 1000); // 4 minutes
  }
}

process.on("SIGTERM", async () => {
  if (globalForPrisma.keepAliveInterval) {
    clearInterval(globalForPrisma.keepAliveInterval);
  }
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  if (globalForPrisma.keepAliveInterval) {
    clearInterval(globalForPrisma.keepAliveInterval);
  }
  await prisma.$disconnect();
  process.exit(0);
});
