import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const logins = await prisma.socialLogin.findMany({
    select: {
      id: true,
      platform: true,
      clientId: true,
      allowedRoles: true,
      allowedUserIds: true,
      adminOnly: true,
    },
  });

  const loginsWithAccess = logins.filter((l: any) => l.allowedUserIds.length > 0 || l.allowedRoles.length > 0);

  const users = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: { id: 'asc' },
  });

  const result = {
    totalLogins: logins.length,
    allLogins: logins,
    loginsWithExplicitPermissions: loginsWithAccess,
    users: users,
  };

  fs.writeFileSync('tmp/debug-output.json', JSON.stringify(result, null, 2));
  console.log('Written to tmp/debug-output.json');
  await prisma.$disconnect();
}

main().catch(console.error);
