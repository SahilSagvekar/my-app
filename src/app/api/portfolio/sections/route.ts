export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { portfolioCategory, portfolioSubcategory } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { asc, eq } from 'drizzle-orm';

interface SubcategoryPayload {
    key: string;
    label: string;
    icon: string;
    isActive: boolean;
}

interface CategoryPayload {
    key: string;
    label: string;
    icon: string;
    isActive: boolean;
    subcategories: SubcategoryPayload[];
}

export async function GET() {
  const { db, closeDb } = getDbPool();
  try {
    try {
        // Ensure Photography section exists (no subcategories) so admins don't
        // need a manual seed after deploy.
        const existingPhotography = await db.query.portfolioCategory.findFirst({
            where: eq(portfolioCategory.key, 'photography'),
        });
        if (!existingPhotography) {
            const allCats = await db
                .select({ order: portfolioCategory.order })
                .from(portfolioCategory)
                .orderBy(asc(portfolioCategory.order));
            const nextOrder =
                allCats.length > 0
                    ? Math.max(...allCats.map((c) => c.order)) + 1
                    : 0;
            await db.insert(portfolioCategory).values({
                id: createId(),
                key: 'photography',
                label: 'Photography',
                iconName: 'ImageIcon',
                isActive: true,
                order: nextOrder,
                updatedAt: new Date().toISOString(),
            });
        }

        const categories = await db.query.portfolioCategory.findMany({
            orderBy: asc(portfolioCategory.order),
            with: { portfolioSubcategories: { orderBy: (sub, { asc }) => asc(sub.order) } },
        });

        const sections = categories.map((cat) => ({
            key: cat.key,
            label: cat.label,
            icon: cat.iconName,
            isActive: cat.isActive,
            subcategories: cat.portfolioSubcategories.map((sub) => ({
                key: sub.key,
                label: sub.label,
                icon: sub.iconName,
                isActive: sub.isActive,
            })),
        }));

        return NextResponse.json({ ok: true, sections });
    } catch (err) {
        console.error('[GET /api/portfolio/sections]', err);
        return NextResponse.json({ ok: false, message: 'Failed to read config' }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}

export async function PATCH(req: NextRequest) {
  const { db, closeDb } = getDbPool();
  try {
    try {
        const body = await req.json();
        const { sections } = body as { sections: CategoryPayload[] };

        if (!Array.isArray(sections)) {
            return NextResponse.json({ ok: false, message: 'Invalid data format' }, { status: 400 });
        }

        // NOTE: Prisma's transaction { timeout, maxWait } options have no
        // direct Drizzle equivalent (interactive transactions here run over
        // the neon-serverless WebSocket driver) — dropped, atomicity preserved.
        await db.transaction(async (tx) => {
            for (let i = 0; i < sections.length; i++) {
                const cat = sections[i];
                const [category] = await tx.insert(portfolioCategory).values({
                    id: createId(),
                    key: cat.key,
                    label: cat.label,
                    iconName: cat.icon,
                    isActive: cat.isActive,
                    order: i,
                    updatedAt: new Date().toISOString(),
                }).onConflictDoUpdate({
                    target: portfolioCategory.key,
                    set: { label: cat.label, iconName: cat.icon, isActive: cat.isActive, order: i, updatedAt: new Date().toISOString() },
                }).returning();

                for (let j = 0; j < cat.subcategories.length; j++) {
                    const sub = cat.subcategories[j];
                    await tx.insert(portfolioSubcategory).values({
                        id: createId(),
                        key: sub.key,
                        label: sub.label,
                        iconName: sub.icon,
                        isActive: sub.isActive,
                        order: j,
                        categoryId: category.id,
                        updatedAt: new Date().toISOString(),
                    }).onConflictDoUpdate({
                        target: portfolioSubcategory.key,
                        set: { label: sub.label, iconName: sub.icon, isActive: sub.isActive, order: j, categoryId: category.id, updatedAt: new Date().toISOString() },
                    });
                }
            }
        });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[PATCH /api/portfolio/sections]', err);
        return NextResponse.json({ ok: false, message: 'Failed to update config' }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}
