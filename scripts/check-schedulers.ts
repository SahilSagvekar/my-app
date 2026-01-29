import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    const schedulerCounts = await prisma.task.groupBy({
        by: ['scheduler'],
        _count: {
            id: true
        }
    });
    console.log("Task counts by scheduler ID:", JSON.stringify(schedulerCounts, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
