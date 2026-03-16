import { prisma } from '../src/lib/prisma';

async function main() {
  const processingFiles = await prisma.file.findMany({
    where: {
      optimizationStatus: 'PROCESSING'
    },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      optimizationStatus: true,
    }
  });

  console.log(JSON.stringify(processingFiles, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
