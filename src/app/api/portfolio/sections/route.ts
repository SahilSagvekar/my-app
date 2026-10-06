export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp, getDbPool } from '@/lib/db';
import { requirePortfolioAdmin } from '@/lib/portfolio-auth';
import { portfolioCategory, portfolioSubcategory, portfolioUiSetting } from '@/lib/db/schema';
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

export interface PortfolioSettings {
    howItWorksVisible: boolean;
}

const SETTINGS_ID = 'default';
const DEFAULT_SETTINGS: PortfolioSettings = { howItWorksVisible: true };

async function readSettings(db: ReturnType<typeof getDbHttp>): Promise<PortfolioSettings> {
    try {
        const [row] = await db
            .select()
            .from(portfolioUiSetting)
            .where(eq(portfolioUiSetting.id, SETTINGS_ID))
            .limit(1);
        if (!row) return { ...DEFAULT_SETTINGS };
        return { howItWorksVisible: row.howItWorksVisible !== false };
    } catch (err) {
        // Table may not exist yet before SQL is applied — don't break sections GET.
        console.warn('[portfolio/sections] settings read failed, using defaults', err);
        return { ...DEFAULT_SETTINGS };
    }
}

async function writeSettings(
    db: ReturnType<typeof getDbHttp>,
    settings: PortfolioSettings
) {
    await db
        .insert(portfolioUiSetting)
        .values({
            id: SETTINGS_ID,
            howItWorksVisible: settings.howItWorksVisible,
            updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
            target: portfolioUiSetting.id,
            set: {
                howItWorksVisible: settings.howItWorksVisible,
                updatedAt: new Date().toISOString(),
            },
        });
}

// Public read — no interactive transaction needed, so use the stateless HTTP driver
// (the WebSocket Pool throws "Network connection lost" under Workers and this is the
// call the whole public portfolio page depends on).
export async function GET() {
  const db = getDbHttp();
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
            // onConflictDoNothing: two concurrent first loads would otherwise race and the
            // loser would 500 on the unique key.
            await db.insert(portfolioCategory).values({
                id: createId(),
                key: 'photography',
                label: 'Photography',
                iconName: 'ImageIcon',
                isActive: true,
                order: nextOrder,
                updatedAt: new Date().toISOString(),
            }).onConflictDoNothing({ target: portfolioCategory.key });
        }

        const categories = await db.query.portfolioCategory.findMany({
            orderBy: asc(portfolioCategory.order),
            with: { portfolioSubcategories: { orderBy: (sub, { asc }) => asc(sub.order) } },
        });

        const settings = await readSettings(db);

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
    // nothing to close — HTTP driver is stateless
  }
}

export async function PATCH(req: NextRequest) {
  const denied = requirePortfolioAdmin(req);
  if (denied) return denied;

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
                    iconName: cat.icon || 'Film',
                    isActive: cat.isActive,
                    order: i,
                    updatedAt: new Date().toISOString(),
                }).onConflictDoUpdate({
                    target: portfolioCategory.key,
                    set: {
                        label: cat.label,
                        iconName: cat.icon || 'Film',
                        isActive: cat.isActive,
                        order: i,
                        updatedAt: new Date().toISOString(),
                    },
                }).returning();

                for (let j = 0; j < subs.length; j++) {
                    const sub = subs[j];
                    await tx.insert(portfolioSubcategory).values({
                        id: createId(),
                        key: sub.key,
                        label: sub.label,
                        iconName: sub.icon || 'Video',
                        isActive: sub.isActive,
                        order: j,
                        categoryId: category.id,
                        updatedAt: new Date().toISOString(),
                    }).onConflictDoUpdate({
                        target: portfolioSubcategory.key,
                        set: {
                            label: sub.label,
                            iconName: sub.icon || 'Video',
                            isActive: sub.isActive,
                            order: j,
                            categoryId: category.id,
                            updatedAt: new Date().toISOString(),
                        },
                    });
                }
            }
        });

        if (settings && typeof settings.howItWorksVisible === 'boolean') {
            try {
                await writeSettings(getDbHttp(), {
                    howItWorksVisible: settings.howItWorksVisible,
                });
            } catch (settingsErr) {
                console.error('[PATCH /api/portfolio/sections] settings write failed', settingsErr);
                return NextResponse.json(
                    {
                        ok: false,
                        message:
                            'Sections saved, but How It Works setting failed. Create the PortfolioUiSetting table (see scripts/sql/create-portfolio-ui-setting.sql) and try again.',
                    },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[PATCH /api/portfolio/sections]', err);
        const message = err instanceof Error ? err.message : 'Failed to update config';
        return NextResponse.json({ ok: false, message }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}
