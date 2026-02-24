
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    try {
        const deliverableId = 'cmk2db47x000jnnskgy8scy1o'; // Just any ID, doesn't even need to exist if we don't have FK validation, but we do have FK validation.

        // Let's find a real deliverable ID
        const deliverable = await prisma.oneOffDeliverable.findFirst();
        if (!deliverable) {
            console.log('No one-off deliverable found');
            return;
        }
        const realId = deliverable.id;
        console.log('Testing with Deliverable ID:', realId);

        console.log('Creating task 1...');
        const task1 = await prisma.task.create({
            data: {
                description: 'Test unique deliverable 1',
                assignedTo: 65,
                oneOffDeliverableId: realId,
            }
        });
        console.log('Created task 1');

        try {
            console.log('Creating task 2...');
            const task2 = await prisma.task.create({
                data: {
                    description: 'Test unique deliverable 2',
                    assignedTo: 65,
                    oneOffDeliverableId: realId,
                }
            });
            console.log('Created task 2 (Deliverable ID is NOT unique in Task)');
            await prisma.task.delete({ where: { id: task2.id } });
        } catch (e: any) {
            console.log('Failed to create task 2 (Deliverable ID IS unique in Task or other error)');
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
