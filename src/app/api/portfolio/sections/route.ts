export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { portfolioCategory, portfolioSubcategory } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { asc, eq } from 'drizzle-orm';
import { promises as fs } from 'fs';
import path from 'path';

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

export interface PortfolioSettings {
    howItWorksVisible: boolean;
}

const SETTINGS_PATH = path.join(process.cwd(), 'src/app/config/portfolioSettings.json');
const DEFAULT_SETTINGS: PortfolioSettings = { howItWorksVisible: true };

async function readSettings(): Promise<PortfolioSettings> {
    try {
        const raw = await fs.readFile(SETTINGS_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            howItWorksVisible:
                typeof parsed.howItWorksVisible === 'boolean'
                    ? parsed.howItWorksVisible
                    : true,
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

async function writeSettings(settings: PortfolioSettings) {
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 4) + '\n', 'utf8');
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

        const settings = await readSettings();

        const sections = categories.map((cat) => ({
            key: cat.key,
            label: cat.label,
            icon: cat.iconName,
            isActive: cat.isActive,
            // Photography is intentionally flat — never expose subcategories.
            subcategories:
                cat.key === 'photography'
                    ? []
                    : cat.portfolioSubcategories.map((sub) => ({
                          key: sub.key,
                          label: sub.label,
                          icon: sub.iconName,
                          isActive: sub.isActive,
                      })),
        }));

        return NextResponse.json({ ok: true, sections, settings });
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
        const { sections, settings } = body as {
            sections: CategoryPayload[];
            settings?: Partial<PortfolioSettings>;
        };

        if (!Array.isArray(sections)) {
            return NextResponse.json({ ok: false, message: 'Invalid data format' }, { status: 400 });
        }

        // NOTE: Prisma's transaction { timeout, maxWait } options have no
        // direct Drizzle equivalent (interactive transactions here run over
        // the neon-serverless WebSocket driver) — dropped, atomicity preserved.
        await db.transaction(async (tx) => {
            for (let i = 0; i < sections.length; i++) {
                const cat = sections[i];
                // Photography never stores subcategories.
                const subs = cat.key === 'photography' ? [] : (cat.subcategories || []);

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

                for (let j = 0; j < subs.length; j++) {
                    const sub = subs[j];
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

        if (settings && typeof settings.howItWorksVisible === 'boolean') {
            const current = await readSettings();
            await writeSettings({
                ...current,
                howItWorksVisible: settings.howItWorksVisible,
            });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[PATCH /api/portfolio/sections]', err);
        return NextResponse.json({ ok: false, message: 'Failed to update config' }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}
