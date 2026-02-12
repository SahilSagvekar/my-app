const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getDeliverableShortCode(type) {
    const normalized = type.toLowerCase().trim();
    if (normalized === "short form videos") return "SF";
    if (normalized === "long form videos") return "LF";
    if (normalized === "square form videos") return "SQF";
    if (normalized === "thumbnails") return "THUMB";
    if (normalized === "tiles") return "T";
    if (normalized === "hard posts / graphic images") return "HP";
    if (normalized === "snapchat episodes") return "SEP";
    if (normalized === "beta short form") return "BSF";
    return type.replace(/\s+/g, "");
}

function formatDateMMDDYYYY(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
}

async function fixTasks() {
    const emptyTasks = await prisma.task.findMany({
        where: { title: "" },
        include: {
            client: true,
            oneOffDeliverable: true,
            monthlyDeliverable: true
        }
    });

    console.log(`Found ${emptyTasks.length} tasks to fix.`);

    for (const task of emptyTasks) {
        const deliverable = task.oneOffDeliverable || task.monthlyDeliverable;
        if (!deliverable) {
            console.warn(`⚠️ No deliverable found for task ${task.id}. Skipping.`);
            continue;
        }

        const companyName = task.client.companyName || task.client.name;
        const companyNameSlug = companyName.replace(/\s/g, '');
        const deliverableSlug = getDeliverableShortCode(deliverable.type);
        const createdAtStr = formatDateMMDDYYYY(task.createdAt);
        const title = `${companyNameSlug}_${createdAtStr}_${deliverableSlug}1`;
        const taskFolderPath = `${companyName}/outputs/${title}/`;

        console.log(`Updating task ${task.id} with title: ${title}`);

        await prisma.task.update({
            where: { id: task.id },
            data: {
                title: title,
                outputFolderId: taskFolderPath
            }
        });
    }

    console.log("Done fixing tasks.");
}

fixTasks()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
