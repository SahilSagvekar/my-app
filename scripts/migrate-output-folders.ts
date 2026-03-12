/**
 * 🔄 Migration Script: Move task output folders into monthly subfolders
 *
 * This script reorganizes existing S3 output folders from:
 *   CompanyName/outputs/TaskTitle/
 * To:
 *   CompanyName/outputs/Month-Year/TaskTitle/
 *
 * It also updates the database (Task.outputFolderId, File.s3Key, File.url).
 *
 * Usage:
 *   DRY RUN (see what would change, no actual changes):
 *     npx tsx scripts/migrate-output-folders.ts
 *
 *   EXECUTE (actually move files and update DB):
 *     npx tsx scripts/migrate-output-folders.ts --execute
 *
 *   SINGLE CLIENT (test with one client first):
 *     npx tsx scripts/migrate-output-folders.ts --execute --client "CompanyName"
 */

import dotenv from "dotenv";
// Try loading .env files (server may not have one — that's fine, it uses system env vars)
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.production" });
dotenv.config({ path: ".env.production.local" });
import { PrismaClient } from "@prisma/client";
import {
    S3Client,
    ListObjectsV2Command,
    CopyObjectCommand,
    DeleteObjectCommand,
    PutObjectCommand,
    HeadObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCopyCommand,
    CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION!,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

// ─────────────────────────────────────────
// CLI Args
// ─────────────────────────────────────────
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const VERBOSE = args.includes("--verbose");
const CLIENT_FILTER = args.includes("--client")
    ? args[args.indexOf("--client") + 1]
    : null;

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function getMonthFolderFromDate(date: Date): string {
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const year = date.getFullYear();
    return `${month}-${year}`; // "February-2026"
}

function getMonthFolderFromTask(task: {
    recurringMonth: string | null;
    dueDate: Date | null;
    createdAt: Date;
    monthFolder?: string | null;
}): string {
    // If monthFolder is already set, use it
    if (task.monthFolder) return task.monthFolder;

    // Always use createdAt to determine the month folder
    return getMonthFolderFromDate(new Date(task.createdAt));
}

function isAlreadyMigrated(outputFolderId: string): boolean {
    // Check if the path already contains a monthly folder pattern
    // Pattern: CompanyName/outputs/MonthName-Year/TaskTitle/
    // Month names: January, February, ..., December
    const monthPattern =
        /\/outputs\/(January|February|March|April|May|June|July|August|September|October|November|December)-\d{4}\//;
    return monthPattern.test(outputFolderId);
}

function extractPartsFromPath(outputFolderId: string): {
    companyName: string;
    taskFolder: string;
} | null {
    const normalized = outputFolderId.endsWith("/")
        ? outputFolderId
        : outputFolderId + "/";

    const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";

    // Try monthly path: CompanyName/outputs/MonthName-YYYY/TaskFolder/
    const monthlyMatch = normalized.match(
        new RegExp(`^(.+?)\/outputs\/(${MONTHS})-\\d{4}\/(.+?)\/`)
    );
    if (monthlyMatch) {
        let companyName: string;
        try { companyName = decodeURIComponent(monthlyMatch[1]); } catch { companyName = monthlyMatch[1]; }
        return { companyName, taskFolder: monthlyMatch[3] };
    }

    // Try flat path: CompanyName/outputs/TaskFolder/
    const flatMatch = normalized.match(/^(.+?)\/outputs\/(.+?)\//);
    if (!flatMatch) return null;

    let companyName: string;
    try { companyName = decodeURIComponent(flatMatch[1]); } catch { companyName = flatMatch[1]; }
    return { companyName, taskFolder: flatMatch[2] };
}

// ─────────────────────────────────────────
// S3 Operations
// ─────────────────────────────────────────

async function listAllObjects(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        });

        const response = await s3Client.send(command);

        if (response.Contents) {
            for (const obj of response.Contents) {
                if (obj.Key) keys.push(obj.Key);
            }
        }

        continuationToken = response.IsTruncated
            ? response.NextContinuationToken
            : undefined;
    } while (continuationToken);

    return keys;
}

const MAX_SINGLE_COPY_SIZE = 4.5 * 1024 * 1024 * 1024; // 4.5GB (S3 limit is 5GB)
const PART_SIZE = 500 * 1024 * 1024; // 500MB chunks for multipart copy

async function getObjectSize(key: string): Promise<number> {
    const response = await s3Client.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );
    return response.ContentLength || 0;
}

async function copyS3Object(
    sourceKey: string,
    destKey: string
): Promise<void> {
    // Get file size to decide copy strategy
    const size = await getObjectSize(sourceKey);

    if (size <= MAX_SINGLE_COPY_SIZE) {
        // Small file: single copy
        await s3Client.send(
            new CopyObjectCommand({
                Bucket: BUCKET,
                CopySource: `${BUCKET}/${encodeURIComponent(sourceKey)}`,
                Key: destKey,
            })
        );
    } else {
        // Large file (>4.5GB): multipart copy
        console.log(`    📦 Large file (${(size / 1024 / 1024 / 1024).toFixed(2)}GB), using multipart copy...`);

        // 1. Initiate multipart upload
        const { UploadId } = await s3Client.send(
            new CreateMultipartUploadCommand({
                Bucket: BUCKET,
                Key: destKey,
            })
        );

        if (!UploadId) throw new Error("Failed to initiate multipart upload");

        // 2. Copy parts
        const parts: { ETag: string; PartNumber: number }[] = [];
        let bytesCopied = 0;
        let partNumber = 1;

        while (bytesCopied < size) {
            const start = bytesCopied;
            const end = Math.min(bytesCopied + PART_SIZE - 1, size - 1);

            const partResponse = await s3Client.send(
                new UploadPartCopyCommand({
                    Bucket: BUCKET,
                    Key: destKey,
                    CopySource: `${BUCKET}/${encodeURIComponent(sourceKey)}`,
                    CopySourceRange: `bytes=${start}-${end}`,
                    UploadId,
                    PartNumber: partNumber,
                })
            );

            if (partResponse.CopyPartResult?.ETag) {
                parts.push({
                    ETag: partResponse.CopyPartResult.ETag,
                    PartNumber: partNumber,
                });
            }

            bytesCopied = end + 1;
            partNumber++;
        }

        // 3. Complete multipart upload
        await s3Client.send(
            new CompleteMultipartUploadCommand({
                Bucket: BUCKET,
                Key: destKey,
                UploadId,
                MultipartUpload: { Parts: parts },
            })
        );

        console.log(`    ✅ Large file copied successfully (${parts.length} parts)`);
    }
}

async function deleteS3Object(key: string): Promise<void> {
    await s3Client.send(
        new DeleteObjectCommand({
            Bucket: BUCKET,
            Key: key,
        })
    );
}

async function ensureFolder(folderPath: string): Promise<void> {
    await s3Client.send(
        new PutObjectCommand({
            Bucket: BUCKET,
            Key: folderPath.endsWith("/") ? folderPath : `${folderPath}/`,
            ContentType: "application/x-directory",
        })
    );
}

// ─────────────────────────────────────────
// Main Migration
// ─────────────────────────────────────────

async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  S3 Output Folder Migration → Monthly Subfolders");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Mode:   ${EXECUTE ? "🔴 EXECUTE (real changes)" : "🟢 DRY RUN (no changes)"}`);
    console.log(`  Client: ${CLIENT_FILTER || "ALL"}`);
    console.log(`  Bucket: ${BUCKET}`);
    console.log("═══════════════════════════════════════════════════════\n");

    // Step 1: Find all tasks (both with and without outputFolderId)
    // We also handle tasks with null outputFolderId that have files
    const whereClause: any = {};

    if (CLIENT_FILTER) {
        // Find client by company name
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
        console.log(`📌 Filtering for client: ${client.companyName || client.name} (${client.id})\n`);
    }

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
                    name: true,
                },
            },
        },
        orderBy: { createdAt: "asc" },
    });

    console.log(`📋 Found ${tasks.length} tasks\n`);

    // Stats
    let alreadyCorrect  = 0;   // already in the right monthly folder
    let wrongMonth      = 0;   // in a monthly folder but wrong month
    let fromFlat        = 0;   // was flat, needs migration
    let nullFolderFixed = 0;   // had no outputFolderId at all
    let skipped         = 0;   // could not parse
    let migrated        = 0;
    let s3ObjectsMoved  = 0;
    let dbRecordsUpdated = 0;
    let errors          = 0;
    const monthDistribution: Record<string, number> = {};

    for (const task of tasks) {
        const currentPath = task.outputFolderId;

        // ─── CASE B: No outputFolderId at all ───
        if (!currentPath) {
            if (!task.clientId || !task.client) { skipped++; continue; }
            const companyName = task.client.companyName || task.client.name || null;
            if (!companyName) { skipped++; continue; }

            const monthFolder = getMonthFolderFromTask(task);
            const sanitizedTitle = (task.title || task.id).replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
            const newPath = `${companyName}/outputs/${monthFolder}/${task.id}-${sanitizedTitle}/`;

            nullFolderFixed++;
            monthDistribution[monthFolder] = (monthDistribution[monthFolder] || 0) + 1;
            console.log(`\n─── Task (no folder) ${nullFolderFixed}: ${task.title || task.id} ───`);
            console.log(`  Month:      ${monthFolder}`);
            console.log(`  New path:   ${newPath}`);
            console.log(`  Files:      ${task.files.length} DB records`);

            if (EXECUTE) {
                try {
                    await ensureFolder(`${companyName}/outputs/${monthFolder}/`);
                    await ensureFolder(newPath);
                    await prisma.task.update({
                        where: { id: task.id },
                        data: { outputFolderId: newPath, monthFolder },
                    });
                    dbRecordsUpdated++;
                    console.log(`  ✅ outputFolderId + monthFolder set`);
                } catch (err: any) {
                    console.error(`  ❌ FAILED: ${err.message}`);
                    errors++;
                }
            }
            continue;
        }

        // ─── CASE A+C: Has an outputFolderId (flat OR monthly — treat the same) ───
        const parts = extractPartsFromPath(currentPath);
        if (!parts) {
            console.warn(`  ⚠️ Could not parse path: ${currentPath} (task: ${task.id})`);
            skipped++;
            continue;
        }

        const monthFolder = getMonthFolderFromTask(task);
        const targetPath  = `${parts.companyName}/outputs/${monthFolder}/${parts.taskFolder}/`;

        // Normalize both paths for comparison (ensure trailing slash)
        const normalizedCurrent = currentPath.endsWith("/") ? currentPath : currentPath + "/";
        const normalizedTarget  = targetPath.endsWith("/")  ? targetPath  : targetPath  + "/";

        monthDistribution[monthFolder] = (monthDistribution[monthFolder] || 0) + 1;

        // ── Already in the correct folder ──
        if (normalizedCurrent === normalizedTarget) {
            alreadyCorrect++;
            // Still update monthFolder DB field if missing
            if (!task.monthFolder && EXECUTE) {
                await prisma.task.update({
                    where: { id: task.id },
                    data: { monthFolder },
                });
            }
            continue;
        }

        // ── Needs to move (flat→monthly OR wrong-month→right-month) ──
        const wasMonthly = isAlreadyMigrated(currentPath);
        if (wasMonthly) wrongMonth++; else fromFlat++;

        const clientName = task.client?.companyName || task.client?.name || "Unknown";
        const moveNum = wrongMonth + fromFlat;
        console.log(`\n─── Task ${moveNum}: ${task.title || task.id} ───`);
        console.log(`  Client:      ${clientName}`);
        console.log(`  Target month:${monthFolder}`);
        console.log(`  Current:     ${currentPath}${wasMonthly ? "  ⚠️ WRONG MONTH" : "  (flat)"}`);
        console.log(`  → Target:    ${targetPath}`);

        if (!EXECUTE) {
            console.log(`  Files:       ${task.files.length} DB records`);
            try {
                const s3Objects = await listAllObjects(currentPath);
                console.log(`  S3 objects:  ${s3Objects.length}`);
                for (const key of s3Objects.slice(0, 5)) console.log(`    → ${key}`);
                if (s3Objects.length > 5) console.log(`    ... and ${s3Objects.length - 5} more`);
            } catch { console.log(`  S3 objects:  (could not list)`); }
            continue;
        }

        // ── EXECUTE ──
        try {
            const s3Objects = await listAllObjects(currentPath);
            console.log(`  S3 objects to move: ${s3Objects.length}`);

            // Ensure the target monthly folder exists
            await ensureFolder(`${parts.companyName}/outputs/${monthFolder}/`);

            // Copy each object to the target path
            for (const sourceKey of s3Objects) {
                const relativePath = sourceKey.replace(normalizedCurrent, "");
                const destKey = `${targetPath}${relativePath}`;
                try {
                    await copyS3Object(sourceKey, destKey);
                    s3ObjectsMoved++;
                } catch (err: any) {
                    console.error(`  ❌ Failed to copy: ${sourceKey} → ${destKey}: ${err.message}`);
                    errors++;
                }
            }

            // Update Task record
            const updatedDriveLinks = (task.driveLinks || []).map((link: string) =>
                link.replace(currentPath, targetPath)
            );
            await prisma.task.update({
                where: { id: task.id },
                data: { outputFolderId: targetPath, monthFolder, driveLinks: updatedDriveLinks },
            });
            dbRecordsUpdated++;
            console.log(`  ✅ Task DB updated`);

            // Update File records
            for (const file of task.files) {
                if (!file.s3Key || !file.s3Key.startsWith(normalizedCurrent)) continue;
                const newS3Key = file.s3Key.replace(normalizedCurrent, targetPath);
                const newUrl   = file.url.replace(currentPath, targetPath);
                await prisma.file.update({
                    where: { id: file.id },
                    data: { s3Key: newS3Key, url: newUrl },
                });
                dbRecordsUpdated++;
                if (VERBOSE) console.log(`  ✅ File updated: ${file.name}`);
            }

            // Delete old S3 objects
            console.log(`  🗑️ Cleaning up ${s3Objects.length} old objects...`);
            for (const sourceKey of s3Objects) {
                try { await deleteS3Object(sourceKey); }
                catch (err: any) { console.error(`  ⚠️ Failed to delete: ${sourceKey}: ${err.message}`); }
            }

            migrated++;
            console.log(`  ✅ Complete`);
        } catch (err: any) {
            console.error(`  ❌ FAILED: ${err.message}`);
            errors++;
        }
    }

    // ─── Summary ───
    const totalToMove = wrongMonth + fromFlat;
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Migration Summary");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Total tasks found:           ${tasks.length}`);
    console.log(`  ✅ Already in correct folder: ${alreadyCorrect}`);
    console.log(`  ⚠️  In wrong monthly folder:    ${wrongMonth}`);
    console.log(`  📂 In flat folder (no month):  ${fromFlat}`);
    console.log(`  ❔ No outputFolderId at all:  ${nullFolderFixed}`);
    console.log(`  ⏩ Skipped (parse error):     ${skipped}`);
    console.log(`  🚚 Total tasks to move:        ${totalToMove}`);

    // ─── Month distribution (all tasks) ───
    if (Object.keys(monthDistribution).length > 0) {
        console.log(`\n  All tasks by destination month:`);
        const monthOrder = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ];
        const sorted = Object.entries(monthDistribution).sort((a, b) => {
            const parseMonth = (m: string) => {
                const [name, year] = m.split("-");
                return parseInt(year) * 100 + monthOrder.indexOf(name);
            };
            return parseMonth(a[0]) - parseMonth(b[0]);
        });
        const total = sorted.reduce((sum, [, n]) => sum + n, 0);
        for (const [month, count] of sorted) {
            const bar = "█".repeat(Math.round((count / total) * 20));
            console.log(`    ${month.padEnd(20)}: ${String(count).padStart(4)} tasks  ${bar}`);
        }
    }

    if (EXECUTE) {
        console.log(`\n  ✅ Successfully migrated:   ${migrated}`);
        console.log(`  S3 objects moved:           ${s3ObjectsMoved}`);
        console.log(`  DB records updated:         ${dbRecordsUpdated}`);
        console.log(`  ❌ Errors:                  ${errors}`);
    } else {
        console.log(`\n  ℹ️ This was a DRY RUN. No changes were made.`);
        console.log(`  To execute, run: npx tsx scripts/migrate-output-folders.ts --execute`);
        console.log(`  To test with one client: npx tsx scripts/migrate-output-folders.ts --execute --client "CompanyName"`);
    }

    console.log("═══════════════════════════════════════════════════════\n");
}

main()
    .catch((err) => {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
