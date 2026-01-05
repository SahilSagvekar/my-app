import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  keepAliveInterval: NodeJS.Timeout | undefined;
  isReconnecting: boolean;
};

// ✅ Create Prisma client with proper connection pool configuration
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['error', 'warn', 'query']
    : ['error', 'warn'],
  // Datasource configuration handled via DATABASE_URL with params
});

// Store in global for both dev AND production
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
  globalForPrisma.isReconnecting = false;

  // ✅ Enhanced keepalive with connection pool health check
  // Runs every 2 minutes for more aggressive keepalive
  if (typeof globalForPrisma.keepAliveInterval === 'undefined') {
    globalForPrisma.keepAliveInterval = setInterval(async () => {
      // Skip if already reconnecting to avoid race conditions
      if (globalForPrisma.isReconnecting) {
        console.log('[Prisma] Skipping keepalive - reconnection in progress');
        return;
      }

      try {
        // Use a timeout for the health check query
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        );

        await Promise.race([
          prisma.$queryRaw`SELECT 1`,
          timeoutPromise
        ]);

        if (process.env.NODE_ENV === 'development') {
          console.log('[Prisma] Keepalive ping successful at', new Date().toISOString());
        }
      } catch (error: any) {
        console.error('[Prisma] Keepalive ping failed:', error.message);

        // Only attempt reconnection if not already reconnecting
        if (!globalForPrisma.isReconnecting) {
          globalForPrisma.isReconnecting = true;

          try {
            console.log('[Prisma] Attempting graceful reconnection...');

            // Disconnect with timeout
            const disconnectPromise = prisma.$disconnect().catch(() => {
              console.log('[Prisma] Disconnect timed out, proceeding anyway');
            });
            await Promise.race([
              disconnectPromise,
              new Promise(resolve => setTimeout(resolve, 3000))
            ]);

            // Small delay before reconnecting
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Reconnect
            await prisma.$connect();
            console.log('[Prisma] Reconnected successfully at', new Date().toISOString());

          } catch (reconnectError: any) {
            console.error('[Prisma] Reconnection failed:', reconnectError.message);
          } finally {
            globalForPrisma.isReconnecting = false;
          }
        }
      }
    }, 2 * 60 * 1000); // 2 minutes - more aggressive keepalive
  }
}

// ✅ Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  console.log(`[Prisma] Received ${signal}, shutting down gracefully...`);

  if (globalForPrisma.keepAliveInterval) {
    clearInterval(globalForPrisma.keepAliveInterval);
    globalForPrisma.keepAliveInterval = undefined;
  }

  try {
    await prisma.$disconnect();
    console.log('[Prisma] Disconnected successfully');
  } catch (error) {
    console.error('[Prisma] Error during disconnect:', error);
  }

  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ✅ Handle uncaught exceptions to prevent zombie connections
process.on("uncaughtException", async (error) => {
  console.error('[Prisma] Uncaught exception, closing connections:', error);
  try {
    await prisma.$disconnect();
  } catch { }
});

process.on("unhandledRejection", async (reason) => {
  console.error('[Prisma] Unhandled rejection:', reason);
});
