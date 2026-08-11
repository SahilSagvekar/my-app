import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error", "warn"],
  });
}

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    console.log("[Prisma] Creating new client (Neon adapter)...");
    console.log("[Prisma] DB URL exists:", !!process.env.DATABASE_URL);
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

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
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unreachable");
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    const client = getPrismaClient();
    const value = client[prop as keyof PrismaClient];

    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});