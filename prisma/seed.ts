// prisma/seed.ts (example seeding script)

import { PrismaClient, Role } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.user.createMany({
    data: [
      {
        name: "Alice QC",
        email: "alice.qc@example.com",
        password: "hashed_password_1",
        role: Role.qc_specialist,
      },
      {
        name: "Bob Specialist",
        email: "bob.specialist@example.com",
        password: "hashed_password_2",
        role: Role.qc_specialist,
      },
      {
        name: "Charlie Editor",
        email: "charlie.editor@example.com",
        password: "hashed_password_3",
        role: Role.editor,
      },
      {
        name: "Diana Videographer",
        email: "diana.vg@example.com",
        password: "hashed_password_4",
        role: Role.videographer,
      },
      {
        name: "Ethan Manager",
        email: "ethan.manager@example.com",
        password: "hashed_password_5",
        role: Role.manager,
      },
      {
        name: "Fiona Admin",
        email: "fiona.admin@example.com",
        password: "hashed_password_6",
        role: Role.admin,
      },
      {
        name: "George QC",
        email: "george.qc@example.com",
        password: "hashed_password_7",
        role: Role.qc_specialist,
      },
      {
        name: "Hannah Specialist",
        email: "hannah.specialist@example.com",
        password: "hashed_password_8",
        role: Role.qc_specialist,
      },
      {
        name: "Ian Editor",
        email: "ian.editor@example.com",
        password: "hashed_password_9",
        role: Role.editor,
      },
      {
        name: "Julia Videographer",
        email: "julia.vg@example.com",
        password: "hashed_password_10",
        role: Role.videographer,
      },
      {
        name: "Kevin Manager",
        email: "kevin.manager@example.com",
        password: "hashed_password_11",
        role: Role.manager,
      },
      {
        name: "Laura Admin",
        email: "laura.admin@example.com",
        password: "hashed_password_12",
        role: Role.admin,
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
