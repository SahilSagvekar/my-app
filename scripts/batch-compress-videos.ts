import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { optimizeVideo } from '../src/lib/video-optimizer';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log('🔍 Fetching videos for batch compression...');
  console.log(isDryRun ? '🧪 MODE: DRY RUN (No files will be modified)' : '🚀 MODE: LIVE (Files will be compressed)');

  // 1. Find all active files that are videos, don't have a proxyUrl, 
  // and status is NOT SCHEDULED
  const files = await prisma.file.findMany({
    where: {
      isActive: true,
      task: {
        status: {
          not: 'SCHEDULED' as any
        }
      },
      // Include if no proxyUrl OR if it's currently just a streaming proxy
      OR: [
        { proxyUrl: null },
        { proxyUrl: { startsWith: '/api/files/' } }
      ],
      // Filter for video files
      AND: [
        {
          OR: [
            { name: { endsWith: '.mp4' } },
            { name: { endsWith: '.mov' } },
            { name: { endsWith: '.m4v' } },
            { mimeType: { startsWith: 'video/' } }
          ]
        }
      ]
    },
    include: {
      task: {
        select: {
          id: true,
          status: true,
          title: true
        }
      }
    }
  });

  console.log(`\n📊 Found ${files.length} videos eligible for compression.`);

  if (files.length === 0) {
    console.log('✅ No videos need compression. Exiting.');
    return;
  }

  // List status summary
  const statusCounts: Record<string, number> = {};
  files.forEach(f => {
    const status = f.task.status || 'UNKNOWN';
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
    console.log('\n💡 Run WITHOUT --dry-run to start actual compression.');
    return;
  }

  console.log('\n⚠️ Starting batch compression in 5 seconds... Press Ctrl+C to cancel.');
  await new Promise(r => setTimeout(r, 5000));

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i + 1}/${files.length}] Processing: ${file.name} (Task: ${file.task.title || file.task.id})`);
    
    try {
      const result = await optimizeVideo(file.id);
      
      if (result.success) {
        console.log(`✅ Success! Proxy set to: ${result.url}`);
        successCount++;
      } else {
        console.log(`❌ Failed: ${result.error}`);
        failCount++;
      }
    } catch (err: any) {
      console.log(`❌ Error processing file ${file.id}: ${err.message}`);
      failCount++;
    }
    
    // Brief pause to avoid overwhelming the system
    await new Promise(r => setTimeout(r, 1000));
  }

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
