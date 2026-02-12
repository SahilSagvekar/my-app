const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const emptyTasks = await prisma.task.findMany({
        where: { title: "" },
        select: { id: true, clientId: true, oneOffDeliverableId: true, monthlyDeliverableId: true }
    });

    console.log(`Found ${emptyTasks.length} tasks with empty titles.`);
    for (const task of emptyTasks) {
        console.log(`- Task ID: ${task.id}, Client: ${task.clientId}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
