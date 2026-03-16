import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const latestVideo = await prisma.file.findFirst({
    where: {
      mimeType: { startsWith: 'video/' },
    },
    orderBy: { uploadedAt: 'desc' }
  });

  if (!latestVideo) {
    console.log('---NO_VIDEO_FOUND---');
    return;
  }

  console.log('---VIDEO_INFO_START---');
  console.log(`ID: ${latestVideo.id}`);
  console.log(`Key: ${latestVideo.s3Key}`);
  console.log(`Name: ${latestVideo.name}`);
  console.log(`URL: ${latestVideo.url}`);
  console.log('---VIDEO_INFO_END---');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
