// debug-specific-clients.ts
// Check specific clients that are reported as missing tasks

import { prisma } from "./src/lib/prisma";

async function debugClients() {
  console.log("=".repeat(70));
  console.log("🔍 DEBUGGING SPECIFIC CLIENTS");
  console.log("=".repeat(70));

  // List of clients to check
  const clientsToCheck = [
    "Coin Laundry Association",
    "CLA",
    "MissBehaveTV", 
    "MissBehave",
    "Miss Behave",
    "Seb Hall",
    "SebHall",
    "Drew Meyers",
    "The Drew Meyers",
    "TheDrewMeyers",
  ];

  // First, let's see ALL clients in the database
  const allClients = await prisma.client.findMany({
    select: { id: true, name: true, companyName: true },
    orderBy: { name: "asc" },
  });

  console.log("\n📋 ALL CLIENTS IN DATABASE:");
  console.log("─".repeat(70));
  for (const c of allClients) {
    console.log(`   ${c.name} | Company: ${c.companyName || "N/A"} | ID: ${c.id}`);
  }

  // Now check tasks for April specifically
  console.log("\n" + "=".repeat(70));
  console.log("📋 APRIL 2026 TASKS BY CLIENT:");
  console.log("=".repeat(70));

  for (const client of allClients) {
    // Count April tasks (tagged)
    const aprilTagged = await prisma.task.count({
      where: {
        clientId: client.id,
        recurringMonth: "2026-04",
      },
    });

    // Count April tasks (by due date, untagged)
    const aprilByDate = await prisma.task.count({
      where: {
        clientId: client.id,
        recurringMonth: null,
        dueDate: {
          gte: new Date(2026, 3, 1),
          lte: new Date(2026, 3, 30, 23, 59, 59),
        },
      },
    });

    // Count May tasks (to see if they went there instead)
    const mayTagged = await prisma.task.count({
      where: {
        clientId: client.id,
        recurringMonth: "2026-05",
      },
    });

    // Count March tasks (for comparison)
    const marchTagged = await prisma.task.count({
      where: {
        clientId: client.id,
        recurringMonth: "2026-03",
      },
    });

    const marchByDate = await prisma.task.count({
      where: {
        clientId: client.id,
        recurringMonth: null,
        dueDate: {
          gte: new Date(2026, 2, 1),
          lte: new Date(2026, 2, 31, 23, 59, 59),
        },
      },
    });

    const totalApril = aprilTagged + aprilByDate;
    const totalMarch = marchTagged + marchByDate;

    const clientName = client.companyName || client.name;
    const status = totalApril > 0 ? "✅" : "❌";

    console.log(`\n${status} ${clientName}`);
    console.log(`   March: ${totalMarch} (tagged: ${marchTagged}, by date: ${marchByDate})`);
    console.log(`   April: ${totalApril} (tagged: ${aprilTagged}, by date: ${aprilByDate})`);
    console.log(`   May:   ${mayTagged} (tagged only)`);

    if (totalApril === 0 && (totalMarch > 0 || mayTagged > 0)) {
      console.log(`   ⚠️  PROBLEM: Has March/May tasks but NO April tasks!`);
    }
  }

  // Check what deliverables these clients should have
  console.log("\n" + "=".repeat(70));
  console.log("📋 DELIVERABLES BY CLIENT:");
  console.log("=".repeat(70));

  for (const client of allClients) {
    const deliverables = await prisma.monthlyDeliverable.findMany({
      where: { clientId: client.id },
    });

    if (deliverables.length > 0) {
      console.log(`\n🏢 ${client.companyName || client.name}`);
      for (const d of deliverables) {
        // Count April tasks for this specific deliverable
        const aprilCount = await prisma.task.count({
          where: {
            clientId: client.id,
            monthlyDeliverableId: d.id,
            monthFolder: "April-2026",
          },
        });

        const status = aprilCount >= (d.quantity || 0) ? "✅" : "❌";
        console.log(`   ${status} ${d.type}: ${aprilCount}/${d.quantity || 0}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  await prisma.$disconnect();
}

debugClients()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });