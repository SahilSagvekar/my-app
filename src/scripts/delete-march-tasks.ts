/**
 * Delete March 2026 tasks that were created prematurely
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteMarchTasks() {
    console.log('🗑️ Deleting March 2026 tasks...\n');

    const marchStart = new Date('2026-03-01T00:00:00.000Z');
    const marchEnd = new Date('2026-03-31T23:59:59.999Z');

    // First, get the count and IDs
    const marchTasks = await prisma.task.findMany({
        where: {
            dueDate: {
                gte: marchStart,
                lte: marchEnd,
            },
        },
        select: { id: true },
    });

    const taskIds = marchTasks.map(t => t.id);
    console.log(`Found ${taskIds.length} March 2026 tasks to delete`);

    if (taskIds.length === 0) {
        console.log('✅ No tasks to delete!');
        return;
    }

    // Delete associated files first (foreign key constraint)
    console.log('Deleting associated files...');
    const deletedFiles = await prisma.file.deleteMany({
        where: { taskId: { in: taskIds } },
    });
    console.log(`   Deleted ${deletedFiles.count} files`);

    // Delete titling jobs
    console.log('Deleting titling jobs...');
    const deletedTitlingJobs = await prisma.titlingJob.deleteMany({
        where: { taskId: { in: taskIds } },
    });
    console.log(`   Deleted ${deletedTitlingJobs.count} titling jobs`);

    // Delete the tasks
    console.log('Deleting tasks...');
    const deletedTasks = await prisma.task.deleteMany({
        where: { id: { in: taskIds } },
    });
    console.log(`   Deleted ${deletedTasks.count} tasks`);

    console.log('\n✅ Cleanup complete!');
    console.log(`   Total tasks removed: ${deletedTasks.count}`);
}

async function main() {
    try {
        await deleteMarchTasks();
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
