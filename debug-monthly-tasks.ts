// compare-march-april.ts
// Compares March 2026 tasks to April 2026 to find missing ones

import { prisma } from "./src/lib/prisma";

async function compareMarchApril() {
  console.log("=".repeat(70));
  console.log("🔍 COMPARING MARCH 2026 vs APRIL 2026 TASKS");
  console.log("=".repeat(70));

  // Get all March tasks grouped by client and deliverable type
  const marchTasks = await prisma.task.findMany({
    where: {
      OR: [
        { recurringMonth: "2026-03" },
        {
          recurringMonth: null,
          dueDate: {
            gte: new Date(2026, 2, 1),
            lte: new Date(2026, 2, 31, 23, 59, 59),
          },
        },
      ],
    },
    include: {
      client: { select: { id: true, name: true, companyName: true } },
    },
  });

  // Get all April tasks
  const aprilTasks = await prisma.task.findMany({
    where: {
      OR: [
        { recurringMonth: "2026-04" },
        {
          recurringMonth: null,
          dueDate: {
            gte: new Date(2026, 3, 1),
            lte: new Date(2026, 3, 30, 23, 59, 59),
          },
        },
      ],
    },
    include: {
      client: { select: { id: true, name: true, companyName: true } },
    },
  });

  console.log(`\n📊 March 2026 tasks: ${marchTasks.length}`);
  console.log(`📊 April 2026 tasks: ${aprilTasks.length}`);

  // Group March tasks by client + taskType
  const marchByClientType: Record<string, { count: number; clientId: string; clientName: string; taskType: string }> = {};
  
  for (const task of marchTasks) {
    const clientName = task.client?.companyName || task.client?.name || "Unknown";
    const key = `${task.clientId}|${task.taskType || "Unknown"}`;
    
    if (!marchByClientType[key]) {
      marchByClientType[key] = {
        count: 0,
        clientId: task.clientId || "",
        clientName,
        taskType: task.taskType || "Unknown",
      };
    }
    marchByClientType[key].count++;
  }

  // Group April tasks by client + taskType
  const aprilByClientType: Record<string, number> = {};
  
  for (const task of aprilTasks) {
    const key = `${task.clientId}|${task.taskType || "Unknown"}`;
    aprilByClientType[key] = (aprilByClientType[key] || 0) + 1;
  }

  // Compare
  console.log("\n" + "─".repeat(70));
  console.log("📋 COMPARISON BY CLIENT + TASK TYPE:");
  console.log("─".repeat(70));

  const missing: { clientName: string; clientId: string; taskType: string; marchCount: number; aprilCount: number; needed: number }[] = [];

  for (const [key, marchData] of Object.entries(marchByClientType)) {
    const aprilCount = aprilByClientType[key] || 0;
    const needed = marchData.count - aprilCount;

    const status = needed <= 0 ? "✅" : "❌";
    console.log(`\n${status} ${marchData.clientName} - ${marchData.taskType}`);
    console.log(`   March: ${marchData.count}, April: ${aprilCount}${needed > 0 ? `, NEED: ${needed}` : ""}`);

    if (needed > 0) {
      missing.push({
        clientName: marchData.clientName,
        clientId: marchData.clientId,
        taskType: marchData.taskType,
        marchCount: marchData.count,
        aprilCount,
        needed,
      });
    }
  }

  // Check for clients that exist in April but not March (new clients)
  console.log("\n" + "─".repeat(70));
  console.log("📋 APRIL-ONLY (new or different):");
  console.log("─".repeat(70));

  for (const [key, count] of Object.entries(aprilByClientType)) {
    if (!marchByClientType[key]) {
      const [clientId, taskType] = key.split("|");
      const sampleTask = aprilTasks.find(t => t.clientId === clientId && t.taskType === taskType);
      const clientName = sampleTask?.client?.companyName || sampleTask?.client?.name || "Unknown";
      console.log(`   🆕 ${clientName} - ${taskType}: ${count} tasks`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 SUMMARY OF MISSING:");
  console.log("=".repeat(70));

  if (missing.length === 0) {
    console.log("\n✅ All March task types have equivalent April coverage!");
  } else {
    let totalNeeded = 0;
    for (const m of missing) {
      console.log(`\n❌ ${m.clientName} - ${m.taskType}`);
      console.log(`   Need ${m.needed} more tasks (March had ${m.marchCount}, April has ${m.aprilCount})`);
      console.log(`   Client ID: ${m.clientId}`);
      totalNeeded += m.needed;
    }
    console.log(`\n📊 TOTAL TASKS NEEDED: ${totalNeeded}`);
  }

  // Also list ALL unique clients with tasks
  console.log("\n" + "─".repeat(70));
  console.log("📋 ALL CLIENTS WITH MARCH OR APRIL TASKS:");
  console.log("─".repeat(70));

  const allClients = new Set<string>();
  marchTasks.forEach(t => allClients.add(t.client?.companyName || t.client?.name || "Unknown"));
  aprilTasks.forEach(t => allClients.add(t.client?.companyName || t.client?.name || "Unknown"));

  const sortedClients = Array.from(allClients).sort();
  for (const client of sortedClients) {
    const marchCount = marchTasks.filter(t => (t.client?.companyName || t.client?.name) === client).length;
    const aprilCount = aprilTasks.filter(t => (t.client?.companyName || t.client?.name) === client).length;
    const status = aprilCount >= marchCount ? "✅" : "❌";
    console.log(`   ${status} ${client}: March=${marchCount}, April=${aprilCount}`);
  }

  console.log("\n" + "=".repeat(70));
  await prisma.$disconnect();
}

compareMarchApril()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });