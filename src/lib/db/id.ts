import cuid from 'cuid';

// Matches Prisma's @default(cuid()) — Drizzle has no equivalent DB default,
// so every insert into a Prisma-cuid-defaulted id column must generate one here.
export function createId(): string {
  return cuid();
}
