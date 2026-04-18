/**
 * Migrate posted content from Task.socialMediaLinks to PostedContent table
 * 
 * Run AFTER prisma migrate:
 * 1. npx prisma migrate dev --name add_posted_content
 * 2. npx tsx scripts/migrate-posted-content.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SocialMediaLink {
  platform: string;
  url: string;
  postedAt?: string;
}

async function migrate() {
  console.log('🚀 Starting PostedContent migration...\n');

  // Find all tasks with socialMediaLinks
  const tasks = await prisma.task.findMany({
    where: {
      socialMediaLinks: { not: { equals: [] } },
      clientId: { not: null },
    },
    select: {
      id: true,
      title: true,
      clientId: true,
      deliverableType: true,
      socialMediaLinks: true,
      dueDate: true,
      createdAt: true,
    },
  });

  console.log(`📊 Found ${tasks.length} tasks with social media links\n`);

  let totalLinks = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const task of tasks) {
    const links = task.socialMediaLinks as SocialMediaLink[];
    
    if (!Array.isArray(links) || links.length === 0) continue;
    if (!task.clientId) continue;

    for (const link of links) {
      totalLinks++;

      if (!link.url || !link.platform) {
        skipped++;
        continue;
      }

      try {
        // Check if already migrated (avoid duplicates)
        const existing = await prisma.postedContent.findFirst({
          where: {
            clientId: task.clientId,
            url: link.url,
            platform: link.platform.toLowerCase(),
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create PostedContent entry
        await prisma.postedContent.create({
          data: {
            clientId: task.clientId,
            title: task.title,
            platform: link.platform.toLowerCase(),
            url: link.url,
            postedAt: link.postedAt ? new Date(link.postedAt) : (task.dueDate || task.createdAt),
            deliverableType: task.deliverableType,
            taskId: task.id,
          },
        });

        created++;
      } catch (err: any) {
        console.error(`❌ Error migrating link from task ${task.id}:`, err.message);
        errors++;
      }
    }
  }

  console.log('\n✅ Migration complete!');
  console.log(`   Total links found: ${totalLinks}`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped (duplicates/invalid): ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

migrate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());