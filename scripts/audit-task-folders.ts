/**
 * 🔍 Audit Script: Analyze task folder organization in S3
 *
 * This script inspects ALL tasks and categorizes them by their folder status:
 *   - Already organized (in monthly folders)
 *   - Flat (needs migration - in outputs/ but not in monthly subfolder)
 *   - Null folder (outputFolderId is null)
 *   - Malformed path (doesn't match any known pattern)
 *   - No monthFolder set (monthFolder field is null in DB)
 *
 * Usage:
 *   npx tsx scripts/audit-task-folders.ts
 *   npx tsx scripts/audit-task-folders.ts --client "CompanyName"
 *   npx tsx scripts/audit-task-folders.ts --verbose
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
const VERBOSE = args.includes("--verbose");
const CLIENT_FILTER = args.includes("--client")
  ? args[args.indexOf("--client") + 1]
  : null;

// ─────────────────────────────────────────
// Pattern matching
// ─────────────────────────────────────────

const MONTH_PATTERN =
  /\/(January|February|March|April|May|June|July|August|September|October|November|December)-\d{4}\//;

function categorizeOutputFolder(outputFolderId: string | null): string {
  if (!outputFolderId) return "NULL_FOLDER";

  // Check if already in monthly folder
  if (MONTH_PATTERN.test(outputFolderId)) return "ORGANIZED";

  // Check if it's a flat outputs path (CompanyName/outputs/TaskTitle/)
  if (/^.+\/outputs\/[^/]+\/?$/.test(outputFolderId)) return "FLAT";

  // Check if it's some other pattern
  if (outputFolderId.includes("/outputs/")) return "MALFORMED";

  return "UNKNOWN";
}

function getMonthFromTask(task: {
  recurringMonth: string | null;
  dueDate: Date | null;
  createdAt: Date;
}): { month: string; source: string } {
  if (task.recurringMonth) {
    // Format: "2026-02" → "February-2026"
    const [year, monthNum] = task.recurringMonth.split("-").map(Number);
    const date = new Date(year, monthNum - 1, 1);
    const monthName = date.toLocaleDateString("en-US", { month: "long" });
    return { month: `${monthName}-${year}`, source: "recurringMonth" };
  }

  if (task.dueDate) {
    const date = new Date(task.dueDate);
    const monthName = date.toLocaleDateString("en-US", { month: "long" });
    const year = date.getFullYear();
    return { month: `${monthName}-${year}`, source: "dueDate" };
  }

  const date = new Date(task.createdAt);
  const monthName = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();
  return { month: `${monthName}-${year}`, source: "createdAt" };
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Task Folder Audit Report");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Client: ${CLIENT_FILTER || "ALL"}`);
  console.log(`  Verbose: ${VERBOSE}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // Build where clause
  const whereClause: any = {};

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

  // Fetch ALL tasks
  const tasks = await prisma.task.findMany({
    where: whereClause,
    select: {
      id: true,
      title: true,
      outputFolderId: true,
      monthFolder: true,
      recurringMonth: true,
      dueDate: true,
      createdAt: true,
      clientId: true,
      status: true,
      driveLinks: true,
      client: {
        select: {
          name: true,
          companyName: true,
        },
      },
      files: {
        select: {
          id: true,
          s3Key: true,
          url: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`📋 Total tasks found: ${tasks.length}\n`);

  // ─── Categorize ───
  const categories: Record<string, typeof tasks> = {
    ORGANIZED: [],
    FLAT: [],
    NULL_FOLDER: [],
    MALFORMED: [],
    UNKNOWN: [],
  };

  let noMonthFolder = 0;
  let hasMonthFolder = 0;
  const monthDistribution: Record<string, number> = {};
  const clientStats: Record<
    string,
    { total: number; organized: number; flat: number; nullFolder: number; malformed: number }
  > = {};

  for (const task of tasks) {
    const category = categorizeOutputFolder(task.outputFolderId);
    categories[category].push(task);

    // Track monthFolder status
    if (task.monthFolder) {
      hasMonthFolder++;
    } else {
      noMonthFolder++;
    }

    // Track month distribution (computed from task data, not the DB field)
    const { month } = getMonthFromTask(task);
    monthDistribution[month] = (monthDistribution[month] || 0) + 1;

    // Track per-client stats
    const clientName =
      task.client?.companyName || task.client?.name || "Unknown";
    if (!clientStats[clientName]) {
      clientStats[clientName] = {
        total: 0,
        organized: 0,
        flat: 0,
        nullFolder: 0,
        malformed: 0,
      };
    }
    clientStats[clientName].total++;
    if (category === "ORGANIZED") clientStats[clientName].organized++;
    if (category === "FLAT") clientStats[clientName].flat++;
    if (category === "NULL_FOLDER") clientStats[clientName].nullFolder++;
    if (category === "MALFORMED") clientStats[clientName].malformed++;
  }

  // ─── Report: Category Summary ───
  console.log("─── Folder Organization Status ───");
  console.log(
    `  ✅ Already organized (monthly):  ${categories.ORGANIZED.length}`
  );
  console.log(`  ⚠️  Flat (needs migration):      ${categories.FLAT.length}`);
  console.log(`  ❌ Null outputFolderId:           ${categories.NULL_FOLDER.length}`);
  console.log(`  🔶 Malformed path:               ${categories.MALFORMED.length}`);
  console.log(`  ❓ Unknown pattern:               ${categories.UNKNOWN.length}`);

  console.log("\n─── monthFolder DB Field Status ───");
  console.log(`  ✅ Has monthFolder set:  ${hasMonthFolder}`);
  console.log(`  ❌ monthFolder is NULL:  ${noMonthFolder}`);

  // ─── Report: Flat tasks detail ───
  if (categories.FLAT.length > 0) {
    console.log(`\n─── Flat Tasks (Need Migration) ───`);
    const maxShow = VERBOSE ? categories.FLAT.length : Math.min(10, categories.FLAT.length);
    for (let i = 0; i < maxShow; i++) {
      const task = categories.FLAT[i];
      const { month, source } = getMonthFromTask(task);
      const clientName =
        task.client?.companyName || task.client?.name || "Unknown";
      console.log(
        `  [${task.id}] "${task.title || "(no title)"}" | Client: ${clientName} | Path: ${task.outputFolderId} | Would assign: ${month} (from ${source})`
      );
    }
    if (!VERBOSE && categories.FLAT.length > 10) {
      console.log(
        `  ... and ${categories.FLAT.length - 10} more (use --verbose to see all)`
      );
    }
  }

  // ─── Report: Null folder tasks detail ───
  if (categories.NULL_FOLDER.length > 0) {
    console.log(`\n─── Null Folder Tasks ───`);
    const withFiles = categories.NULL_FOLDER.filter(
      (t) => t.files.length > 0
    );
    const withoutFiles = categories.NULL_FOLDER.filter(
      (t) => t.files.length === 0
    );
    console.log(
      `  With files in DB: ${withFiles.length} | Without files: ${withoutFiles.length}`
    );

    const maxShow = VERBOSE ? withFiles.length : Math.min(10, withFiles.length);
    for (let i = 0; i < maxShow; i++) {
      const task = withFiles[i];
      const { month, source } = getMonthFromTask(task);
      const clientName =
        task.client?.companyName || task.client?.name || "Unknown";
      console.log(
        `  [${task.id}] "${task.title || "(no title)"}" | Client: ${clientName} | ${task.files.length} files | Would assign: ${month} (from ${source})`
      );
    }
    if (!VERBOSE && withFiles.length > 10) {
      console.log(
        `  ... and ${withFiles.length - 10} more (use --verbose to see all)`
      );
    }
  }

  // ─── Report: Malformed paths ───
  if (categories.MALFORMED.length > 0) {
    console.log(`\n─── Malformed Paths ───`);
    for (const task of categories.MALFORMED) {
      console.log(`  [${task.id}] Path: ${task.outputFolderId}`);
    }
  }

  // ─── Report: Per-client breakdown ───
  console.log(`\n─── Per-Client Breakdown ───`);
  const sortedClients = Object.entries(clientStats).sort(
    (a, b) => b[1].total - a[1].total
  );
  console.log(
    `  ${"Client".padEnd(35)} | Total | ✅Org | ⚠️Flat | ❌Null | 🔶Mal`
  );
  console.log(`  ${"-".repeat(80)}`);
  for (const [name, stats] of sortedClients) {
    console.log(
      `  ${name.padEnd(35)} | ${String(stats.total).padStart(5)} | ${String(stats.organized).padStart(5)} | ${String(stats.flat).padStart(5)} | ${String(stats.nullFolder).padStart(5)} | ${String(stats.malformed).padStart(5)}`
    );
  }

  // ─── Report: Month distribution ───
  console.log(`\n─── Computed Month Distribution (from task dates) ───`);
  const sortedMonths = Object.entries(monthDistribution).sort((a, b) => {
    // Sort by year then month
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
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Total tasks:                    ${tasks.length}`);
  console.log(`  Need S3 folder migration:       ${categories.FLAT.length}`);
  console.log(
    `  Need monthFolder backfill:      ${noMonthFolder}`
  );
  console.log(
    `  Tasks with null outputFolderId: ${categories.NULL_FOLDER.length} (${categories.NULL_FOLDER.filter((t) => t.files.length > 0).length} have files)`
  );
  console.log(`  Malformed paths:                ${categories.MALFORMED.length}`);
  console.log("═══════════════════════════════════════════════════════\n");
}

main()
  .catch((err) => {
    console.error("❌ Audit failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
