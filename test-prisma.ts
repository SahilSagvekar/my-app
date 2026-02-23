import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const count = await prisma.user.count();
        console.log('User count:', count);
    } catch (err) {
        console.error('Prisma connection error:', err);
    } finally {
        await prisma.$disconnect();
    }
}
main();
