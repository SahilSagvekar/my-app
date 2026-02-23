import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  keepAliveInterval: NodeJS.Timeout | undefined;
  isReconnecting: boolean;
  lastSuccessfulPing: Date | undefined;
  initialized: boolean;
};

// ✅ Lazy initialization - creates client only when first accessed
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["error", "warn"] 
      : ["error", "warn"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  return client;
}

// ✅ Get or create the Prisma client
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    console.log("[Prisma] Creating new client...");
    console.log("[Prisma] DB URL exists:", !!process.env.DATABASE_URL);

    globalForPrisma.prisma = createPrismaClient();
    globalForPrisma.isReconnecting = false;
    globalForPrisma.lastSuccessfulPing = new Date();
    globalForPrisma.initialized = true;

    // Setup keepalive
    setupKeepalive();

    console.log("[Prisma] Client initialized, keepalive interval set to 45s");
  }

  return globalForPrisma.prisma;
}

// ✅ Keepalive setup (runs once)
function setupKeepalive() {
  if (globalForPrisma.keepAliveInterval) return;

  globalForPrisma.keepAliveInterval = setInterval(async () => {
    if (globalForPrisma.isReconnecting || !globalForPrisma.prisma) return;

    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Health check timeout")), 5000)
      );

      await Promise.race([
        globalForPrisma.prisma.$queryRaw`SELECT 1`,
        timeoutPromise,
      ]);

      globalForPrisma.lastSuccessfulPing = new Date();
      console.log(`[Prisma] ✓ Keepalive OK (${Date.now() - startTime}ms)`);
    } catch (error: any) {
      console.error(`[Prisma] ✗ Keepalive FAILED:`, error.message);
      await attemptReconnection();
    }
  }, 45 * 1000);
}

// ✅ Reconnection logic
async function attemptReconnection() {
  if (globalForPrisma.isReconnecting || !globalForPrisma.prisma) return;

  globalForPrisma.isReconnecting = true;

  try {
    console.log("[Prisma] Attempting reconnection...");

    await globalForPrisma.prisma.$disconnect().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await globalForPrisma.prisma.$connect();

    globalForPrisma.lastSuccessfulPing = new Date();
    console.log("[Prisma] ✓ Reconnected successfully");
  } catch (error: any) {
    console.error("[Prisma] ✗ Reconnection FAILED:", error.message);
  } finally {
    globalForPrisma.isReconnecting = false;
  }
}

// ✅ Helper to check connection errors
function isConnectionError(error: any): boolean {
  const errorCode = error?.code;
  const errorMessage = error?.message?.toLowerCase() || "";

  return (
    errorCode === "P2024" ||
    errorCode === "P1017" ||
    errorCode === "P1001" ||
    errorCode === "P1002" ||
    errorCode === "P1008" ||
    errorMessage.includes("connection") ||
    errorMessage.includes("etimedout") ||
    errorMessage.includes("econnreset") ||
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("closed") ||
    errorMessage.includes("prepared statement")
  );
}

// ✅ Retry wrapper for queries
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; label?: string } = {}
): Promise<T> {
  const { retries = 2, label = "query" } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (isConnectionError(error) && attempt < retries) {
        console.log(`[Prisma] Retry ${attempt + 1}/${retries} for ${label}...`);
        await getPrismaClient().$disconnect().catch(() => {});
        await new Promise((r) => setTimeout(r, 500 + attempt * 500));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unreachable");
}

// ✅ Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`[Prisma] ${signal} received, shutting down...`);

  if (globalForPrisma.keepAliveInterval) {
    clearInterval(globalForPrisma.keepAliveInterval);
  }

  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect().catch(() => {});
  }

  process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ✅ Export - uses Proxy for lazy access
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];
    
    // Bind methods to the client
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});