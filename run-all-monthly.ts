// run-all-monthly.ts
// Generates monthly recurring tasks for ALL clients for the current month

import { prisma } from "./src/lib/prisma";

async function runAllMonthly() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  
  console.log("🚀 Starting monthly task generation for all clients...\n");
  console.log(`📅 Target month: ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}\n`);

  const clients = await prisma.client.findMany({ 
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  console.log(`Found ${clients.length} clients\n`);
  console.log("━".repeat(50));

  let totalCreated = 0;
  let clientsProcessed = 0;
  let errors: string[] = [];

  for (const client of clients) {
    try {
      const res = await fetch(`${baseUrl}/api/clients/${client.id}/run-monthly`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await res.json();
      
      if (data.success) {
        if (data.created > 0) {
          console.log(`✅ ${client.name}: Created ${data.created} tasks`);
          totalCreated += data.created;
        } else {
          console.log(`⏭️  ${client.name}: ${data.message || "No tasks needed"}`);
        }
      } else {
        console.log(`❌ ${client.name}: ${data.message || data.error || "Failed"}`);
        errors.push(`${client.name}: ${data.message || data.error}`);
      }
      
      clientsProcessed++;
    } catch (error) {
      console.log(`❌ ${client.name}: ${error}`);
      errors.push(`${client.name}: ${error}`);
    }
  }

  console.log("\n" + "━".repeat(50));
  console.log(`\n🎉 Complete!`);
  console.log(`   📦 Clients processed: ${clientsProcessed}/${clients.length}`);
  console.log(`   ✨ Total tasks created: ${totalCreated}`);
  
  if (errors.length > 0) {
    console.log(`   ⚠️  Errors: ${errors.length}`);
    errors.forEach(e => console.log(`      - ${e}`));
  }

  await prisma.$disconnect();
}

runAllMonthly()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });