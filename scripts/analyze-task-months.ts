/**
 * Quick analysis: Show every task with all date fields
 * so we can decide which field determines the monthly folder.
 *
 * Usage:
 *     npx tsx scripts/analyze-task-months.ts
 *     npx tsx scripts/analyze-task-months.ts --client "The Dating Blind Show"
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.production" });
dotenv.config({ path: ".env.production.local" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CLIENT_FILTER = process.argv.find((a) => a === "--client")
    ? process.argv[process.argv.indexOf("--client") + 1]
    : null;

function monthName(date: Date): string {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  Task Monthly Folder Analysis");
    console.log("═══════════════════════════════════════════════════════\n");

    const whereClause: any = {
        outputFolderId: { not: null },
    };

    if (CLIENT_FILTER) {
        const client = await prisma.client.findFirst({
            where: {
                OR: [
                    { companyName: { contains: CLIENT_FILTER, mode: "insensitive" } },
                    { name: { contains: CLIENT_FILTER, mode: "insensitive" } },
                ],
            },
        });
        if (!client) {
            console.error(`❌ Client not found: ${CLIENT_FILTER}`);
            process.exit(1);
        }
        whereClause.clientId = client.id;
        console.log(`📌 Client: ${client.companyName || client.name}\n`);
    }

    const tasks = await prisma.task.findMany({
        where: whereClause,
        select: {
            id: true,
            title: true,
            outputFolderId: true,
            recurringMonth: true,
            dueDate: true,
            createdAt: true,
            client: {
                select: { name: true, companyName: true },
            },
        },
        orderBy: { createdAt: "asc" },
    });

    console.log(`Found ${tasks.length} tasks with output folders\n`);
    console.log("─".repeat(120));
    console.log(
        padRight("Task Title", 45) +
        padRight("recurringMonth", 16) +
        padRight("dueDate", 16) +
        padRight("createdAt", 16) +
        padRight("Current Folder", 30)
    );
    console.log("─".repeat(120));

    for (const task of tasks) {
        const currentFolder = task.outputFolderId || "N/A";

        // Extract any existing month folder from path
        const monthMatch = currentFolder.match(
            /\/(January|February|March|April|May|June|July|August|September|October|November|December)-\d{4}\//
        );
        const currentMonthFolder = monthMatch ? monthMatch[0].replace(/\//g, "") : "NOT MIGRATED";

        const recurringMonth = task.recurringMonth || "—";
        const dueDate = task.dueDate
            ? monthName(new Date(task.dueDate))
            : "—";
        const createdAt = monthName(new Date(task.createdAt));

        console.log(
            padRight(task.title || task.id, 45) +
            padRight(recurringMonth, 16) +
            padRight(dueDate, 16) +
            padRight(createdAt, 16) +
            padRight(currentMonthFolder, 30)
        );
    }

    console.log("─".repeat(120));
    console.log("\n📊 Summary of which field maps to which month:\n");

    // Group by the different date fields to show discrepancies
    const discrepancies: string[] = [];
    for (const task of tasks) {
        const rm = task.recurringMonth
            ? (() => {
                const [y, m] = task.recurringMonth.split("-").map(Number);
                return monthName(new Date(y, m - 1, 1));
            })()
            : null;
        const dd = task.dueDate ? monthName(new Date(task.dueDate)) : null;
        const ca = monthName(new Date(task.createdAt));

        const allSame = rm === dd && dd === ca;
        if (!allSame) {
            discrepancies.push(
                `  ${padRight(task.title || task.id, 45)} ` +
                `RM=${rm || "—"}  DD=${dd || "—"}  CA=${ca}`
            );
        }
    }

    if (discrepancies.length === 0) {
        console.log("  ✅ All date fields agree for every task!");
    } else {
        console.log(`  ⚠️ ${discrepancies.length} tasks have different months across fields:\n`);
        console.log(`  ${padRight("Task", 45)} recurringMonth  dueDate         createdAt`);
        console.log("  " + "─".repeat(110));
        for (const d of discrepancies) {
            console.log(d);
        }
    }

    await prisma.$disconnect();
}

function padRight(str: string, len: number): string {
    if (str.length > len - 2) str = str.substring(0, len - 3) + "…";
    return str.padEnd(len);
}

main().catch((err) => {
    console.error("❌ Error:", err);
    prisma.$disconnect();
    process.exit(1);
});
