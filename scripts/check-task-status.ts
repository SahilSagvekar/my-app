import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const counts = await prisma.task.groupBy({
        by: ['status'],
        _count: {
            id: true
        }
    });
    console.log("Task counts by status:", JSON.stringify(counts, null, 2));

    const scheduledTasks = await prisma.task.findMany({
        where: { status: 'SCHEDULED' },
        select: { id: true, title: true }
    });
    console.log("Scheduled tasks sample:", JSON.stringify(scheduledTasks.slice(0, 5), null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
