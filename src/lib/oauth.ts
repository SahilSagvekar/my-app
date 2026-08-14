import { getDb } from './db';
import { account as accountTable, user as userTable } from './db/schema';
import { createId } from './db/id';
import { and, eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

export async function findOrCreateOAuthUser(
  provider: string,
  providerAccountId: string,
  email: string,
  name?: string
) {
  const { db, closeDb } = getDb();
  try {
  // Check if account exists
  const existingAccount = await db.query.account.findFirst({
    where: and(
      eq(accountTable.provider, provider),
      eq(accountTable.providerAccountId, providerAccountId),
    ),
    with: { user: true },
  });

  if (existingAccount) {
    return existingAccount.user;
  }

  // Check if user with this email exists
  let [user] = await db.select().from(userTable).where(eq(userTable.email, email)).limit(1);

  if (!user) {
    // Create new user with role: null
    const [newUser] = await db.insert(userTable).values({
      email,
      name: name || email,
      role: null,
      updatedAt: new Date().toISOString(),
    }).returning();
    user = newUser;
  }

  // Link OAuth account to user
  await db.insert(accountTable).values({
    id: createId(),
    userId: user.id,
    type: 'oauth',
    provider,
    providerAccountId,
  });

  return user;

  } finally {
    await closeDb();
  }
}

export function generateAuthToken(userId: number, role: string | null) {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}
