import { prisma } from './prisma';
import jwt from 'jsonwebtoken';

export async function findOrCreateOAuthUser(
  provider: string,
  providerAccountId: string,
  email: string,
  name?: string
) {
  // Check if account exists
  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existingAccount) {
    return existingAccount.user;
  }

  // Check if user with this email exists
  let user = await prisma.user.findFirst({
    where: { email },
  });

  if (!user) {
    // Create new user with role: null
    user = await prisma.user.create({
      data: {
        email,
        name: name || email,
        role: null,
      },
    });
  }

  // Link OAuth account to user
  await prisma.account.create({
    data: {
      userId: user.id,
      type: 'oauth',
      provider,
      providerAccountId,
    },
  });

  return user;
}

export function generateAuthToken(userId: number, role: string | null) {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}