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
    // Expected format: CompanyName/outputs/TaskTitle/
    const match = outputFolderId.match(/^(.+?)\/outputs\/(.+?)\/$/);
    if (!match) return null;
    return {
        companyName: match[1],
        taskFolder: match[2],
    };
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

    // Step 1: Find all tasks with outputFolderId
    const whereClause: any = {
        outputFolderId: { not: null },
    };

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

    console.log(`📋 Found ${tasks.length} tasks with output folders\n`);

    // Stats
    let alreadyMigrated = 0;
    let skipped = 0;
    let toMigrate = 0;
    let migrated = 0;
    let s3ObjectsMoved = 0;
    let dbRecordsUpdated = 0;
    let errors = 0;

    for (const task of tasks) {
        const oldPath = task.outputFolderId!;

        // Skip if already in monthly folder format
        if (isAlreadyMigrated(oldPath)) {
            alreadyMigrated++;
            continue;
        }

        // Parse the old path
        const parts = extractPartsFromPath(oldPath);
        if (!parts) {
            console.warn(`  ⚠️ Could not parse path: ${oldPath} (task: ${task.id})`);
            skipped++;
            continue;
        }

        // Determine the month folder from: recurringMonth > dueDate > createdAt
        let monthFolder: string;

        if (task.recurringMonth) {
            // recurringMonth format: "2026-02" → parse to get "February-2026"
            const [year, month] = task.recurringMonth.split("-").map(Number);
            const date = new Date(year, month - 1, 1);
            monthFolder = getMonthFolderFromDate(date);
        } else if (task.dueDate) {
            monthFolder = getMonthFolderFromDate(new Date(task.dueDate));
        } else {
            monthFolder = getMonthFolderFromDate(new Date(task.createdAt));
        }

        // Build the new path
        const newPath = `${parts.companyName}/outputs/${monthFolder}/${parts.taskFolder}/`;

        toMigrate++;

        const clientName = task.client?.companyName || task.client?.name || "Unknown";
        console.log(`\n─── Task ${toMigrate}: ${task.title || task.id} ───`);
        console.log(`  Client:    ${clientName}`);
        console.log(`  Month:     ${monthFolder}`);
        console.log(`  Old path:  ${oldPath}`);
        console.log(`  New path:  ${newPath}`);

        if (!EXECUTE) {
            // Dry run: just show what would happen
            const fileCount = task.files.length;
            console.log(`  Files:     ${fileCount} DB records`);

            // Check S3 for actual objects
            try {
                const s3Objects = await listAllObjects(oldPath);
                console.log(`  S3 objects: ${s3Objects.length}`);
                for (const key of s3Objects.slice(0, 5)) {
                    console.log(`    → ${key}`);
                }
                if (s3Objects.length > 5) {
                    console.log(`    ... and ${s3Objects.length - 5} more`);
                }
            } catch (err) {
                console.log(`  S3 objects: (could not list)`);
            }

            continue;
        }

        // ─── EXECUTE MODE ───

        try {
            // 1. List all S3 objects under the old path
            const s3Objects = await listAllObjects(oldPath);
            console.log(`  S3 objects to move: ${s3Objects.length}`);

            if (s3Objects.length === 0) {
                console.log(`  ℹ️ No S3 objects found, updating DB only`);
            }

            // 2. Ensure the monthly folder exists
            await ensureFolder(`${parts.companyName}/outputs/${monthFolder}/`);

            // 3. Copy each object to the new path
            for (const sourceKey of s3Objects) {
                // Replace the old prefix with the new prefix
                const relativePath = sourceKey.replace(oldPath, "");
                const destKey = `${newPath}${relativePath}`;

                try {
                    await copyS3Object(sourceKey, destKey);
                    s3ObjectsMoved++;
                } catch (err: any) {
                    console.error(`  ❌ Failed to copy: ${sourceKey} → ${destKey}: ${err.message}`);
                    errors++;
                }
            }

            // 4. Update Task.outputFolderId + driveLinks
            const updatedDriveLinks = (task.driveLinks || []).map((link: string) =>
                link.replace(oldPath, newPath)
            );
            await prisma.task.update({
                where: { id: task.id },
                data: {
                    outputFolderId: newPath,
                    driveLinks: updatedDriveLinks,
                },
            });
            dbRecordsUpdated++;
            console.log(`  ✅ Task.outputFolderId + driveLinks updated`);

            // 5. Update File records (s3Key and url)
            for (const file of task.files) {
                if (!file.s3Key) continue;

                // Only update if the file's s3Key starts with the old path
                if (file.s3Key.startsWith(oldPath)) {
                    const newS3Key = file.s3Key.replace(oldPath, newPath);
                    const newUrl = file.url.replace(
                        encodeURIComponent(oldPath).replace(/%2F/g, "/"),
                        encodeURIComponent(newPath).replace(/%2F/g, "/")
                    );

                    // Simpler URL replacement - just replace the path segment
                    const simpleNewUrl = file.url.replace(oldPath, newPath);

                    await prisma.file.update({
                        where: { id: file.id },
                        data: {
                            s3Key: newS3Key,
                            url: simpleNewUrl,
                        },
                    });
                    dbRecordsUpdated++;
                    console.log(`  ✅ File updated: ${file.name} (s3Key + url)`);
                }
            }

            // 6. Delete old S3 objects (only after everything succeeded)
            console.log(`  🗑️ Cleaning up ${s3Objects.length} old objects...`);
            for (const sourceKey of s3Objects) {
                try {
                    await deleteS3Object(sourceKey);
                } catch (err: any) {
                    console.error(`  ⚠️ Failed to delete old: ${sourceKey}: ${err.message}`);
                }
            }

            migrated++;
            console.log(`  ✅ Migration complete for this task`);
        } catch (err: any) {
            console.error(`  ❌ FAILED: ${err.message}`);
            errors++;
        }
    }

    // ─── Summary ───
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  Migration Summary");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Total tasks found:       ${tasks.length}`);
    console.log(`  Already migrated:        ${alreadyMigrated}`);
    console.log(`  Skipped (parse error):   ${skipped}`);
    console.log(`  Tasks to migrate:        ${toMigrate}`);

    if (EXECUTE) {
        console.log(`  ✅ Successfully migrated: ${migrated}`);
        console.log(`  S3 objects moved:        ${s3ObjectsMoved}`);
        console.log(`  DB records updated:      ${dbRecordsUpdated}`);
        console.log(`  ❌ Errors:               ${errors}`);
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
