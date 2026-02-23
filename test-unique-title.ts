
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    try {
        console.log('Cleaning up old test tasks...');
        await prisma.task.deleteMany({ where: { title: 'UNIQUE_TEST_TITLE' } });

        console.log('Creating task 1...');
        const task1 = await prisma.task.create({
            data: {
                description: 'Test unique title 1',
                assignedTo: 65,
                clientId: 'cmk2daby0000donnskbu1ej3k',
                title: 'UNIQUE_TEST_TITLE',
            }
        });
        console.log('Created task 1');

        try {
            console.log('Creating task 2...');
            const task2 = await prisma.task.create({
                data: {
                    description: 'Test unique title 2',
                    assignedTo: 65,
                    clientId: 'cmk2daby0000donnskbu1ej3k',
                    title: 'UNIQUE_TEST_TITLE',
                }
            });
            console.log('Created task 2 (Title is NOT unique)');
            await prisma.task.delete({ where: { id: task2.id } });
        } catch (e: any) {
            console.log('Failed to create task 2 (Title IS unique or other error)');
            console.log('Error code:', e.code);
        }

        await prisma.task.delete({ where: { id: task1.id } });
    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
