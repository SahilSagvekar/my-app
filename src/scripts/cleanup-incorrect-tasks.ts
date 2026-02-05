/**
 * Cleanup Script: Identify incorrectly created tasks
 * Outputs results to cleanup-results.json
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

async function findProblematicTasks() {
    console.log('Searching for incorrectly created tasks...');

    const results: any = {
        marchTasks: [],
        wronglyNamedTasks: [],
        summary: {},
        taskIdsToDelete: [],
    };

    // 1. Find March 2026 tasks (created prematurely in February)
    const marchStart = new Date('2026-03-01T00:00:00.000Z');
    const marchEnd = new Date('2026-03-31T23:59:59.999Z');

    const marchTasks = await prisma.task.findMany({
        where: {
            dueDate: {
                gte: marchStart,
                lte: marchEnd,
            },
        },
        select: {
            id: true,
            title: true,
            dueDate: true,
            createdAt: true,
            client: {
                select: {
                    name: true,
                    companyName: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    results.marchTasks = marchTasks.map(t => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate?.toISOString().split('T')[0],
        createdAt: t.createdAt?.toISOString().split('T')[0],
        clientName: t.client?.name,
        companyName: t.client?.companyName,
    }));

    console.log(`Found ${marchTasks.length} March 2026 tasks`);

    // 2. Find tasks where title uses name instead of companyName
    const clientsWithDifferentNames = await prisma.client.findMany({
        where: {
            AND: [
                { companyName: { not: null } },
                { companyName: { not: '' } },
            ],
        },
        select: {
            id: true,
            name: true,
            companyName: true,
        },
    });

    const mismatchedClients = clientsWithDifferentNames.filter(
        c => c.companyName && c.name !== c.companyName
    );

    console.log(`Found ${mismatchedClients.length} clients where name != companyName`);

    for (const client of mismatchedClients) {
        const nameSlug = client.name.replace(/\s+/g, '');

        const tasksWithWrongName = await prisma.task.findMany({
            where: {
                clientId: client.id,
                title: {
                    startsWith: nameSlug + '_',
                },
            },
            select: {
                id: true,
                title: true,
                dueDate: true,
                createdAt: true,
            },
        });

        if (tasksWithWrongName.length > 0) {
            results.wronglyNamedTasks.push({
                clientName: client.name,
                companyName: client.companyName,
                wrongPrefix: nameSlug + '_',
                correctPrefix: client.companyName!.replace(/\s+/g, '') + '_',
                taskCount: tasksWithWrongName.length,
                tasks: tasksWithWrongName.map(t => ({
                    id: t.id,
                    title: t.title,
                    dueDate: t.dueDate?.toISOString().split('T')[0],
                })),
            });
        }
    }

    // Collect all task IDs
    const allIds = [
        ...marchTasks.map(t => t.id),
        ...results.wronglyNamedTasks.flatMap((c: any) => c.tasks.map((t: any) => t.id)),
    ];
    results.taskIdsToDelete = [...new Set(allIds)];

    results.summary = {
        marchTaskCount: marchTasks.length,
        wronglyNamedClientCount: results.wronglyNamedTasks.length,
        wronglyNamedTaskCount: results.wronglyNamedTasks.reduce((sum: number, c: any) => sum + c.taskCount, 0),
        totalUniqueTasksToDelete: results.taskIdsToDelete.length,
    };

    // Write to file
    writeFileSync('cleanup-results.json', JSON.stringify(results, null, 2));
    console.log('\nResults written to cleanup-results.json');
    console.log('Summary:', results.summary);

    return results;
}

async function main() {
    try {
        await findProblematicTasks();
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
