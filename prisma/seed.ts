import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const demoUsers: Array<{ email: string; name: string; role: Role; password: string }> = [
  { email: "admin@demo.com", name: "Demo Admin", role: "admin", password: "demo123" },
  { email: "manager@demo.com", name: "Demo Manager", role: "manager", password: "demo123" },
  { email: "editor@demo.com", name: "Demo Editor", role: "editor", password: "demo123" },
  { email: "qc@demo.com", name: "Demo QC", role: "qc", password: "demo123" },
  { email: "scheduler@demo.com", name: "Demo Scheduler", role: "scheduler", password: "demo123" },
  { email: "videographer@demo.com", name: "Demo Videographer", role: "videographer", password: "demo123" },
  { email: "client@demo.com", name: "Demo Client", role: "client", password: "demo123" },
];

async function main() {
  for (const user of demoUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const existing = await prisma.user.findFirst({ where: { email: user.email } });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: user.name,
          role: user.role,
          password: passwordHash,
          employeeStatus: "ACTIVE",
        },
      });
      continue;
    }

    await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        password: passwordHash,
        employeeStatus: "ACTIVE",
      },
    });
  }

  console.log(`Seeded ${demoUsers.length} demo users.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
