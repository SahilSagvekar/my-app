// One-time / idempotent: ensure Photography category exists (no subcategories).
//   npx tsx scripts/seed-portfolio-photography.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const maxOrder = await prisma.portfolioCategory.aggregate({ _max: { order: true } });
  const order = (maxOrder._max.order ?? -1) + 1;

  const category = await prisma.portfolioCategory.upsert({
    where: { key: 'photography' },
    update: {
      label: 'Photography',
      iconName: 'ImageIcon',
      isActive: true,
    },
    create: {
      key: 'photography',
      label: 'Photography',
      iconName: 'ImageIcon',
      isActive: true,
      order,
    },
  });

  console.log(`Photography category ready: ${category.id} (order ${category.order})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
