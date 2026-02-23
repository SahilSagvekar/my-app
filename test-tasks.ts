import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    try {
        const tasks = await prisma.task.findMany({
            take: 5,
            select: { id: true, title: true, status: true }
        });
        console.log('Tasks found:', tasks.length);
        console.log('Sample task:', JSON.stringify(tasks[0], null, 2));
    } catch (err) {
        console.error('Prisma connection error:', err);
    } finally {
        await prisma.$disconnect();
    }
}
main();
