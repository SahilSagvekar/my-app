import { PrismaClient } from "@prisma/client";

// ─────────────────────────────────────────
// Singleton Prisma Client
// ─────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create once, reuse forever (per process)
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });

// In dev, preserve client across hot-reloads
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ─────────────────────────────────────────
// Retry wrapper for transient connection errors
// ─────────────────────────────────────────

function isConnectionError(error: any): boolean {
  const code = error?.code;
  const msg = error?.message?.toLowerCase() || "";
  return (
    code === "P2024" ||
    code === "P1017" ||
    code === "P1001" ||
    code === "P1002" ||
    code === "P1008" ||
    msg.includes("connection") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("closed") ||
    msg.includes("prepared statement")
  );
}

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
        console.warn(
          `[Prisma] Retry ${attempt + 1}/${retries} for ${label}...`
        );
        // Brief backoff before retry
        await new Promise((r) => setTimeout(r, 500 + attempt * 500));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unreachable");
}