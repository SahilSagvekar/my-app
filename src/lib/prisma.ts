import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  keepAliveInterval: NodeJS.Timeout | undefined;
  isReconnecting: boolean;
  lastSuccessfulPing: Date | undefined;
};

// ✅ Create Prisma client with proper connection pool configuration
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['error', 'warn', 'query']
    : ['error', 'warn'],
  // Datasource configuration handled via DATABASE_URL with params
});

// ✅ Helper to check if error is a connection error (NeonDB specific)
function isConnectionError(error: any): boolean {
  const errorCode = error?.code;
  const errorMessage = error?.message?.toLowerCase() || '';

  return (
    errorCode === 'P2024' || // Connection pool timeout
    errorCode === 'P1017' || // Server closed connection
    errorCode === 'P1001' || // Can't reach database server
    errorCode === 'P1002' || // Database server timed out
    errorCode === 'P1008' || // Operations timed out
    errorMessage.includes('connection') ||
    errorMessage.includes('etimedout') ||
    errorMessage.includes('econnreset') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('socket') ||
    errorMessage.includes('closed') ||
    errorMessage.includes('terminating connection') ||
    errorMessage.includes('prepared statement') // NeonDB pgbouncer issue
  );
}

// ✅ Wrapper for automatic retry on connection errors
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; label?: string } = {}
): Promise<T> {
  const { retries = 2, label = 'query' } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const shouldRetry = isConnectionError(error) && attempt < retries;

      if (shouldRetry) {
        console.log(`[Prisma] Connection error on ${label}, retrying (attempt ${attempt + 1}/${retries})...`);

        try {
          // Force disconnect and wait
          await prisma.$disconnect().catch(() => { });
          await new Promise(resolve => setTimeout(resolve, 500 + (attempt * 500)));
          // Prisma will auto-reconnect on next query
        } catch {
          // Ignore disconnect errors
        }
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unreachable');
}

// Store in global for both dev AND production
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
  globalForPrisma.isReconnecting = false;
  globalForPrisma.lastSuccessfulPing = new Date();

  // ✅ Enhanced keepalive with connection pool health check
  // Runs every 45 seconds for NeonDB (their idle timeout can be aggressive)
  if (typeof globalForPrisma.keepAliveInterval === 'undefined') {
    globalForPrisma.keepAliveInterval = setInterval(async () => {
      // Skip if already reconnecting to avoid race conditions
      if (globalForPrisma.isReconnecting) {
        console.log('[Prisma] Skipping keepalive - reconnection in progress');
        return;
      }

      const startTime = Date.now();

      try {
        // Use a timeout for the health check query
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout after 5s')), 5000)
        );

        await Promise.race([
          prisma.$queryRaw`SELECT 1`,
          timeoutPromise
        ]);

        const duration = Date.now() - startTime;
        globalForPrisma.lastSuccessfulPing = new Date();

        // ✅ Always log in production so we can see the keepalive is working
        console.log(`[Prisma] ✓ Keepalive OK (${duration}ms) at ${new Date().toISOString()}`);

      } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error(`[Prisma] ✗ Keepalive FAILED after ${duration}ms:`, error.message);

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
            console.log('[Prisma] ✓ Reconnected successfully at', new Date().toISOString());
            globalForPrisma.lastSuccessfulPing = new Date();

          } catch (reconnectError: any) {
            console.error('[Prisma] ✗ Reconnection FAILED:', reconnectError.message);
          } finally {
            globalForPrisma.isReconnecting = false;
          }
        }
      }
    }, 45 * 1000); // 45 seconds - optimized for NeonDB
  }

  // Log startup
  console.log('[Prisma] Client initialized, keepalive interval set to 45s');
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
