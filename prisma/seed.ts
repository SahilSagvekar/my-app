// prisma/seed.ts (example seeding script)

import { PrismaClient, Role } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.user.createMany({
    data: [
      {
        name: "Eric Davis",
        email: "eric.qc@example.com",
        password: "hashed_password_1",
        role: Role.admin,
      },
      {
        name: "Prince Aljon Arambulo",
        email: "prince.specialist@example.com",
        password: "hashed_password_2",
        role: Role.manager,
      },
      {
        name: "Vida Mari Devanadera",
        email: "vida@example.com",
        password: "hashed_password_3",
        role: Role.qc_specialist,
      },
      {
        name: "Veronica",
        email: "veronica.vg@example.com",
        password: "hashed_password_4",
        role: Role.scheduler,
      },
      {
        name: "John Henry Uyan",
        email: "john@example.com",
        password: "hashed_password_5",
        role: Role.editor,
      },
      {
        name: "Robert Dave Pamplona",
        email: "robert@example.com",
        password: "hashed_password_7",
        role: Role.editor,
      },
      {
        name: "Val Almonte",
        email: "val@example.com",
        password: "hashed_password_7",
        role: Role.editor,
      },
      {
        name: "Hanzel Endriga",
        email: "hanzel.@example.com",
        password: "hashed_password_9",
        role: Role.editor,
      },
      {
        name: "Patrick Quin Llanos",
        email: "patrick@example.com",
        password: "hashed_password_10",
        role: Role.editor,
      },
      {
        name: "Farah",
        email: "farah@example.com",
        password: "hashed_password_11",
        role: Role.editor,
      },
    ],
  });
}

main()
  .then(async () => {
    console.log("✅ Seeded 12 users");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
