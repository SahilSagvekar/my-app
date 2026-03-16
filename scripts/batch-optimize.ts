import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { optimizeVideo } from '../src/lib/video-optimizer';

// ---------------------------------------------------------------------------
// Simple promise semaphore — limits concurrent async operations
// ---------------------------------------------------------------------------
function createSemaphore(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  return async function acquire<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>(resolve => queue.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const CONCURRENCY = parseInt(
    process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] ?? '3'
  );

  console.log('🔍 Fetching videos for batch compression...');
  console.log(isDryRun
    ? '🧪 MODE: DRY RUN (No files will be modified)'
    : `🚀 MODE: LIVE (Files will be compressed, concurrency=${CONCURRENCY})`
  );

  const files = await prisma.file.findMany({
    where: {
      isActive: true,
      optimizationStatus: { not: 'FAILED' },
      task: { status: { not: 'SCHEDULED' as any } },
      OR: [
        { proxyUrl: null },
        { proxyUrl: { startsWith: '/api/files/' } },
      ],
      AND: [
        {
          OR: [
            { name: { endsWith: '.mp4' } },
            { name: { endsWith: '.mov' } },
            { name: { endsWith: '.m4v' } },
            { name: { endsWith: '.MOV' } },
            { name: { endsWith: '.MP4' } },
            { mimeType: { startsWith: 'video/' } },
          ],
        },
      ],
    },
    include: {
      task: { select: { id: true, status: true, title: true } },
    },
  });

  console.log(`\n📊 Found ${files.length} videos eligible for compression.`);

  if (files.length === 0) {
    console.log('✅ No videos need compression. Exiting.');
    return;
  }

  // Status distribution summary
  const statusCounts: Record<string, number> = {};
  files.forEach(f => {
    const status = (f.task.status as string) || 'UNKNOWN';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('\n📈 Distribution by Status:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(` - ${status}: ${count} files`);
  });

  if (isDryRun) {
    console.log('\n📝 Sample files that would be processed:');
    files.slice(0, 10).forEach(f => {
      console.log(` - [${f.task.status}] ${f.name} (ID: ${f.id})`);
    });
    console.log(`\n💡 Run WITHOUT --dry-run to start actual compression.`);
    console.log(`   Use --concurrency=N to control parallelism (default: 3).`);
    return;
  }

  console.log(`\n⚠️  Starting batch compression in 5 seconds... Press Ctrl+C to cancel.`);
  await new Promise(r => setTimeout(r, 5000));

  let successCount = 0;
  let failCount = 0;
  const sem = createSemaphore(CONCURRENCY);

  await Promise.all(
    files.map((file, i) =>
      sem(async () => {
        console.log(`\n[${i + 1}/${files.length}] Processing: ${file.name} (Task: ${file.task.title || file.task.id})`);
        try {
          const result = await optimizeVideo(file.id);
          if (result.success) {
            console.log(`✅ [${i + 1}/${files.length}] Success! Proxy: ${result.url}`);
            successCount++;
          } else {
            console.log(`❌ [${i + 1}/${files.length}] Failed: ${result.error}`);
            failCount++;
          }
        } catch (err: any) {
          console.log(`❌ [${i + 1}/${files.length}] Error: ${err.message}`);
          failCount++;
        }
      })
    )
  );

  console.log('\n🏁 Batch Processing Complete!');
  console.log(`✅ Successfully compressed: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📉 Total processed: ${successCount + failCount}`);
}

main()
  .catch((e) => {
    console.error('💥 Script crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
