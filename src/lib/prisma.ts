// import { PrismaClient } from "@prisma/client";

// const globalForPrisma = globalThis as unknown as { 
//   prisma: PrismaClient | undefined 
// };

// export const prisma = globalForPrisma.prisma ?? new PrismaClient({
//   log: process.env.NODE_ENV === 'production' 
//     ? ['error', 'warn'] 
//     : ['error', 'warn'],
// });

// // ✅ Health check to keep connection alive
// if (process.env.NODE_ENV === 'production') {
//   // Run keepalive every 60 seconds
//   setInterval(async () => {
//     try {
//       await prisma.$queryRaw`SELECT 1`;
//       console.log('[Prisma] Connection keepalive: OK');
//     } catch (error: any) {
//       console.error('[Prisma] Connection keepalive failed:', error.message);
      
//       // Try to reconnect
//       try {
//         await prisma.$disconnect();
//         await prisma.$connect();
//         console.log('[Prisma] Reconnected successfully');
//       } catch (reconnectError: any) {
//         console.error('[Prisma] Reconnection failed:', reconnectError.message);
//       }
//     }
//   }, 60000);
  
//   // Initial connection
//   prisma.$connect()
//     .then(() => console.log('[Prisma] Initial connection established'))
//     .catch((error) => console.error('[Prisma] Initial connection failed:', error));
// }

// // ✅ Cleanup on shutdown
// process.on('beforeExit', async () => {
//   await prisma.$disconnect();
// });

// process.on('SIGINT', async () => {
//   await prisma.$disconnect();
//   process.exit(0);
// });

// process.on('SIGTERM', async () => {
//   await prisma.$disconnect();
//   process.exit(0);
// });

// if (process.env.NODE_ENV !== "production") {
//   globalForPrisma.prisma = prisma;
// }

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { 
  prisma: PrismaClient | undefined 
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Store in global for both dev AND production
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}