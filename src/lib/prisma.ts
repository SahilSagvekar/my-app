import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn']  // Only errors in production
      // : ['query', 'error', 'warn'],  // Full logging in dev
      : ['error'],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
