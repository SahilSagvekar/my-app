import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Scanning for video files to enable proxy streaming...');

  // 1. Find all video files that don't have a proxyUrl yet
  const videos = await prisma.file.findMany({
    where: {
      AND: [
        { mimeType: { startsWith: 'video/' } },
        { proxyUrl: null }
      ]
    }
  });

  console.log(`🎥 Found ${videos.length} videos to update.`);

  let updatedCount = 0;
  for (const video of videos) {
    try {
      await prisma.file.update({
        where: { id: video.id },
        data: {
          proxyUrl: `/api/files/${video.id}/stream`
        }
      });
      updatedCount++;
      if (updatedCount % 10 === 0) {
        console.log(`✅ Updated ${updatedCount}/${videos.length}...`);
      }
    } catch (err) {
      console.error(`❌ Failed to update video ${video.id}:`, err.message);
    }
  }

  console.log(`\n✨ Successfully enabled proxy streaming for ${updatedCount} videos.`);
  console.log('🚀 All videos will now use the high-performance streaming proxy!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
