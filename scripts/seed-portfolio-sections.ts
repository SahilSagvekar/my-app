

// One-time migration: load src/app/config/portfolio.json into
  // PortfolioCategory / PortfolioSubcategory. Run with:
  //   npx tsx scripts/seed-portfolio-sections.ts
  // Safe to re-run — upserts by unique `key`.
  import { promises as fs } from 'fs';
  import path from 'path';
  import { PrismaClient } from '@prisma/client';

  const prisma = new PrismaClient();

  interface JsonSubcategory {
    key: string;
    label: string;
    icon: string;
    isActive: boolean;
  }

  interface JsonCategory {
    key: string;
    label: string;
    icon: string;
    isActive: boolean;
    subcategories: JsonSubcategory[];
  }

  async function main() {
    const filePath = path.join(process.cwd(), 'src/app/config/portfolio.json');
    const raw = await fs.readFile(filePath, 'utf8');
    const categories: JsonCategory[] = JSON.parse(raw);

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const category = await prisma.portfolioCategory.upsert({
        where: { key: cat.key },
        update: { label: cat.label, iconName: cat.icon, isActive: cat.isActive, order: i },
        create: { key: cat.key, label: cat.label, iconName: cat.icon, isActive: cat.isActive, order: i },
      });

      for (let j = 0; j < cat.subcategories.length; j++) {
        const sub = cat.subcategories[j];
        await prisma.portfolioSubcategory.upsert({
          where: { key: sub.key },
          update: { label: sub.label, iconName: sub.icon, isActive: sub.isActive, order: j, categoryId: category.id },
          create: { key: sub.key, label: sub.label, iconName: sub.icon, isActive: sub.isActive, order: j, categoryId: category.id },
        });
      }

      console.log(`Seeded category "${cat.key}" with ${cat.subcategories.length} subcategories`);
    }
  }

  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
