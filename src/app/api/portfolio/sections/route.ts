export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    try {
        const categories = await prisma.portfolioCategory.findMany({
            orderBy: { order: 'asc' },
            include: { subcategories: { orderBy: { order: 'asc' } } },
        });

        const sections = categories.map((cat) => ({
            key: cat.key,
            label: cat.label,
            icon: cat.iconName,
            isActive: cat.isActive,
            subcategories: cat.subcategories.map((sub) => ({
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
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { sections } = body as { sections: CategoryPayload[] };

        if (!Array.isArray(sections)) {
            return NextResponse.json({ ok: false, message: 'Invalid data format' }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < sections.length; i++) {
                const cat = sections[i];
                const category = await tx.portfolioCategory.upsert({
                    where: { key: cat.key },
                    update: { label: cat.label, iconName: cat.icon, isActive: cat.isActive, order: i },
                    create: { key: cat.key, label: cat.label, iconName: cat.icon, isActive: cat.isActive, order: i },
                });

                for (let j = 0; j < cat.subcategories.length; j++) {
                    const sub = cat.subcategories[j];
                    await tx.portfolioSubcategory.upsert({
                        where: { key: sub.key },
                        update: { label: sub.label, iconName: sub.icon, isActive: sub.isActive, order: j, categoryId: category.id },
                        create: { key: sub.key, label: sub.label, iconName: sub.icon, isActive: sub.isActive, order: j, categoryId: category.id },
                    });
                }
            }
        }, { timeout: 20000, maxWait: 10000 });

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[PATCH /api/portfolio/sections]', err);
        return NextResponse.json({ ok: false, message: 'Failed to update config' }, { status: 500 });
    }
}
