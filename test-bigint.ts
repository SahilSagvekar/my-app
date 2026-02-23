import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const file = await prisma.file.findFirst({
            select: { id: true, size: true }
        });
        console.log('File found:', file);
        console.log('JSON serialized:', JSON.stringify(file));
    } catch (err) {
        console.error('Prisma error:', err);
    } finally {
        await prisma.$disconnect();
    }
}
main();
