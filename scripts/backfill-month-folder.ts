/**
 * 📅 Backfill Script: Set monthFolder on all tasks that have it null
 *
 * This script ONLY updates the database (Task.monthFolder) — it does NOT
 * move any S3 files. Use migrate-output-folders.ts for S3 moves.
 *
 * Priority for determining month:
 *   1. recurringMonth field (format "2026-02" → "February-2026")
 *   2. dueDate
 *   3. createdAt (always available as fallback)
 *
 * Usage:
 *   DRY RUN:     npx tsx scripts/backfill-month-folder.ts
 *   EXECUTE:     npx tsx scripts/backfill-month-folder.ts --execute
 *   ONE CLIENT:  npx tsx scripts/backfill-month-folder.ts --execute --client "CompanyName"
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.production" });
dotenv.config({ path: ".env.production.local" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─────────────────────────────────────────
// CLI Args
// ─────────────────────────────────────────
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const CLIENT_FILTER = args.includes("--client")
  ? args[args.indexOf("--client") + 1]
  : null;

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function getMonthFolderFromDate(date: Date): string {
  const month = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${month}-${year}`;
}

function computeMonthFolder(task: {
  recurringMonth: string | null;
  dueDate: Date | null;
  createdAt: Date;
}): { month: string; source: string } {
  // Always use createdAt to determine the month folder
  return {
    month: getMonthFolderFromDate(new Date(task.createdAt)),
    source: "createdAt",
  };
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  monthFolder Backfill");
  console.log("═══════════════════════════════════════════════════════");
  console.log(
    `  Mode:   ${EXECUTE ? "🔴 EXECUTE (real changes)" : "🟢 DRY RUN (no changes)"}`
  );
  console.log(`  Client: ${CLIENT_FILTER || "ALL"}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // Build where clause — only tasks with null monthFolder
  const whereClause: any = {
    monthFolder: null,
  };

  if (CLIENT_FILTER) {
    const client = await prisma.client.findFirst({
      where: {
        OR: [
          { companyName: CLIENT_FILTER },
          { name: CLIENT_FILTER },
        ],
      },
    });

    if (!client) {
      console.error(`❌ Client not found: ${CLIENT_FILTER}`);
      process.exit(1);
    }

    whereClause.clientId = client.id;
    console.log(
      `📌 Filtering for client: ${client.companyName || client.name} (${client.id})\n`
    );
  }

  // Fetch tasks with null monthFolder
  const tasks = await prisma.task.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      recurringMonth: true,
      dueDate: true,
      createdAt: true,
      clientId: true,
      client: {
        select: {
          name: true,
          companyName: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📋 Found ${tasks.length} tasks with null monthFolder\n`);

  if (tasks.length === 0) {
    console.log("✅ All tasks already have monthFolder set. Nothing to do.");
    return;
  }

  // Stats
  let updated = 0;
  let errors = 0;
  const sourceStats: Record<string, number> = {
    recurringMonth: 0,
    dueDate: 0,
    createdAt: 0,
  };
  const monthDistribution: Record<string, number> = {};

  // Process in batches of 500
  const BATCH_SIZE = 500;
  const batches = Math.ceil(tasks.length / BATCH_SIZE);

  for (let batch = 0; batch < batches; batch++) {
    const start = batch * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, tasks.length);
    const batchTasks = tasks.slice(start, end);

    console.log(
      `  Processing batch ${batch + 1}/${batches} (tasks ${start + 1}-${end})...`
    );

    if (EXECUTE) {
      // Use a transaction for each batch
      const updates = batchTasks.map((task) => {
        const { month, source } = computeMonthFolder(task);
        sourceStats[source]++;
        monthDistribution[month] = (monthDistribution[month] || 0) + 1;

        return prisma.task.update({
          where: { id: task.id },
          data: { monthFolder: month },
        });
      });

      try {
        await prisma.$transaction(updates);
        updated += batchTasks.length;
      } catch (err: any) {
        console.error(`  ❌ Batch ${batch + 1} failed: ${err.message}`);
        errors += batchTasks.length;
      }
    } else {
      // Dry run — just count
      for (const task of batchTasks) {
        const { month, source } = computeMonthFolder(task);
        sourceStats[source]++;
        monthDistribution[month] = (monthDistribution[month] || 0) + 1;
        updated++;
      }
    }
  }

  // ─── Month distribution ───
  console.log(`\n─── Month Distribution ───`);
  const sortedMonths = Object.entries(monthDistribution).sort((a, b) => {
    const parseMonth = (m: string) => {
      const [monthName, year] = m.split("-");
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      return parseInt(year) * 100 + months.indexOf(monthName);
    };
    return parseMonth(b[0]) - parseMonth(a[0]);
  });
  for (const [month, count] of sortedMonths) {
    console.log(`  ${month.padEnd(20)} : ${count} tasks`);
  }

  // ─── Summary ───
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Backfill Summary");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Total tasks processed: ${tasks.length}`);
  console.log(`  ${EXECUTE ? "Updated" : "Would update"}: ${updated}`);
  console.log(`  Errors:               ${errors}`);
  console.log(`  Source breakdown:`);
  console.log(`    From recurringMonth: ${sourceStats.recurringMonth}`);
  console.log(`    From dueDate:        ${sourceStats.dueDate}`);
  console.log(`    From createdAt:      ${sourceStats.createdAt}`);

  if (!EXECUTE) {
    console.log(
      `\n  ℹ️ This was a DRY RUN. No changes were made.`
    );
    console.log(
      `  To execute, run: npx tsx scripts/backfill-month-folder.ts --execute`
    );
  }

  console.log("═══════════════════════════════════════════════════════\n");
}

main()
  .catch((err) => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
