import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const latestVideo = await prisma.file.findFirst({
    where: { mimeType: { startsWith: 'video/' } },
    orderBy: { uploadedAt: 'desc' }
  });

  if (latestVideo) {
    // Handle BigInt for JSON.stringify
    const serialized = JSON.stringify(latestVideo, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value, 
    2);
    
    fs.writeFileSync('test_video_info.json', serialized);
    console.log('✅ Wrote info to test_video_info.json');
  } else {
    console.log('❌ No video found');
  }
}

main().finally(() => prisma.$disconnect());
