// src/lib/finance/expenses.ts
// Shared helpers for Financials 2 → Expenses.

import { asc, eq, sql } from 'drizzle-orm';
import type { getDbHttp } from '@/lib/db';
import { expenseCategory as categoryTable } from '@/lib/db/schema';
import { createId } from '@/lib/db/id';

type Db = ReturnType<typeof getDbHttp>;

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Software & Subscriptions',
  'Equipment',
  'Travel',
  'Meals',
  'Marketing',
  'Rent & Utilities',
  'Professional Services',
  'Office Supplies',
  'Other',
];

/** Active categories, seeding a sensible starter set the first time it's empty. */
export async function getActiveCategories(db: Db) {
  let rows = await db
    .select({ id: categoryTable.id, name: categoryTable.name })
    .from(categoryTable)
    .where(eq(categoryTable.isActive, true))
    .orderBy(asc(categoryTable.name));

  if (rows.length === 0) {
    const all = await db.select({ id: categoryTable.id }).from(categoryTable).limit(1);
    if (all.length === 0) {
      await db
        .insert(categoryTable)
        .values(DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ id: createId(), name })))
        .onConflictDoNothing();
      rows = await db
        .select({ id: categoryTable.id, name: categoryTable.name })
        .from(categoryTable)
        .where(eq(categoryTable.isActive, true))
        .orderBy(asc(categoryTable.name));
    }
  }
  return rows;
}

/**
 * Resolve the category for an expense: an existing id, or a new name (reuses a
 * category whose name matches case-insensitively, otherwise creates it).
 * Returns null when neither is usable.
 */
export async function resolveCategoryId(
  db: Db,
  categoryId: unknown,
  newCategoryName: unknown,
): Promise<string | null> {
  if (typeof newCategoryName === 'string' && newCategoryName.trim()) {
    const name = newCategoryName.trim().slice(0, 60);
    const [found] = await db
      .select({ id: categoryTable.id })
      .from(categoryTable)
      .where(sql`lower(${categoryTable.name}) = ${name.toLowerCase()}`)
      .limit(1);
    if (found) return found.id;
    const [created] = await db.insert(categoryTable).values({ id: createId(), name }).returning({ id: categoryTable.id });
    return created.id;
  }
  if (typeof categoryId === 'string' && categoryId) {
    const [found] = await db.select({ id: categoryTable.id }).from(categoryTable).where(eq(categoryTable.id, categoryId)).limit(1);
    return found?.id ?? null;
  }
  return null;
}
