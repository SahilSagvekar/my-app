/**
 * Reassign all tasks from Mark (ID: 23) to Daena (ID: 123)
 * Run: npx tsx scripts/reassign-scheduler.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OLD_SCHEDULER_ID = 23;  // Mark
const NEW_SCHEDULER_ID = 123; // Daena Azineth Loisaga

async function main() {
  console.log('🔄 Reassigning tasks from scheduler ID', OLD_SCHEDULER_ID, 'to', NEW_SCHEDULER_ID);

  // Verify new scheduler exists
  const newScheduler = await prisma.user.findUnique({
    where: { id: NEW_SCHEDULER_ID },
    select: { id: true, name: true, role: true }
  });

  if (!newScheduler) {
    console.error('❌ New scheduler not found with ID:', NEW_SCHEDULER_ID);
    process.exit(1);
  }

  console.log('✅ New scheduler found:', newScheduler.name, '(role:', newScheduler.role + ')');

  // Count tasks to update
  const count = await prisma.task.count({
    where: { scheduler: OLD_SCHEDULER_ID }
  });

  console.log(`📊 Found ${count} tasks assigned to old scheduler`);

  if (count === 0) {
    console.log('✅ No tasks to reassign');
    return;
  }

  // Update all tasks
  const result = await prisma.task.updateMany({
    where: { scheduler: OLD_SCHEDULER_ID },
    data: { scheduler: NEW_SCHEDULER_ID }
  });

  console.log(`✅ Reassigned ${result.count} tasks to ${newScheduler.name}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());