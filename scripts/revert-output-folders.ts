/**
 * 🔄 REVERT: Undo migrate-output-folders.ts and/or backfill-month-folder.ts
 *
 * --revert-migrate  (default)
 *     Moves S3 files BACK from monthly → flat paths.
 *     Reverts Task.outputFolderId, Task.driveLinks, File.s3Key, File.url.
 *     Also clears Task.monthFolder.
 *     Undoes: migrate-output-folders.ts --execute
 *
 * --revert-backfill
 *     Sets Task.monthFolder = NULL for all matching tasks. DB only, no S3.
 *     Undoes: backfill-month-folder.ts --execute
 *             AND the monthFolder backfill inside migrate-output-folders.ts
 *
 * --both
 *     Runs --revert-migrate first, then --revert-backfill for any remaining.
 *
 * Usage (always dry-run first!):
 *     npx tsx scripts/revert-output-folders.ts --revert-migrate --client "Name"
 *     npx tsx scripts/revert-output-folders.ts --revert-backfill --client "Name"
 *     npx tsx scripts/revert-output-folders.ts --both --client "Name"
 *
 *     Add --execute to actually make changes:
 *     npx tsx scripts/revert-output-folders.ts --both --execute --client "The Dating Blind Show"
 */

import dotenv from "dotenv";
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
    HeadObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCopyCommand,
    CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const BUCKET = process.env.AWS_S3_BUCKET || "e8-app-s3-prod";
const EXECUTE         = process.argv.includes("--execute");
const VERBOSE         = process.argv.includes("--verbose");
const REVERT_MIGRATE  = process.argv.includes("--revert-migrate") || process.argv.includes("--both") || (!process.argv.includes("--revert-backfill"));
const REVERT_BACKFILL = process.argv.includes("--revert-backfill") || process.argv.includes("--both");
const CLIENT_FILTER   = process.argv.includes("--client")
    ? process.argv[process.argv.indexOf("--client") + 1]
    : null;

// Monthly folder regex pattern
const MONTH_PATTERN = /^(.+?)\/outputs\/(January|February|March|April|May|June|July|August|September|October|November|December)-\d{4}\/(.+?\/)$/;

function isMonthlyPath(path: string): boolean {
    return MONTH_PATTERN.test(path);
}

function getOriginalPath(monthlyPath: string): string | null {
    const match = monthlyPath.match(MONTH_PATTERN);
    if (!match) return null;
    // match[1] = CompanyName
    // match[2] = MonthName (e.g., February)
    // match[3] = TaskTitle/
    return `${match[1]}/outputs/${match[3]}`;
}

function getMonthFolder(monthlyPath: string): string | null {
    const match = monthlyPath.match(MONTH_PATTERN);
    if (!match) return null;
    return `${match[2]}-${monthlyPath.match(/(\d{4})\//)?.[1] || ""}`;
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
                if (obj.Key && obj.Size && obj.Size > 0) {
                    keys.push(obj.Key);
                }
            }
        }

        continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return keys;
}

const MAX_SINGLE_COPY_SIZE = 4.5 * 1024 * 1024 * 1024;
const PART_SIZE = 500 * 1024 * 1024;

async function getObjectSize(key: string): Promise<number> {
    const response = await s3Client.send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );
    return response.ContentLength || 0;
}

async function copyS3Object(sourceKey: string, destKey: string): Promise<void> {
    const size = await getObjectSize(sourceKey);

    if (size <= MAX_SINGLE_COPY_SIZE) {
        await s3Client.send(
            new CopyObjectCommand({
                Bucket: BUCKET,
                CopySource: `${BUCKET}/${encodeURIComponent(sourceKey)}`,
                Key: destKey,
            })
        );
    } else {
        console.log(`    📦 Large file (${(size / 1024 / 1024 / 1024).toFixed(2)}GB), using multipart copy...`);

        const { UploadId } = await s3Client.send(
            new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: destKey })
        );
        if (!UploadId) throw new Error("Failed to initiate multipart upload");

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
        new DeleteObjectCommand({ Bucket: BUCKET, Key: key })
    );
}

// ─────────────────────────────────────────
// Main
// ─────────────────────────────────────────

async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  REVERT: Output Folder Migration");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Mode:              ${EXECUTE ? "🔴 EXECUTE (real changes)" : "🟢 DRY RUN (no changes)"}`);
    console.log(`  Revert S3/migrate: ${REVERT_MIGRATE  ? "✅ YES" : "⬛ NO"}`);
    console.log(`  Revert backfill:   ${REVERT_BACKFILL ? "✅ YES" : "⬛ NO"}`);
    console.log(`  Client:            ${CLIENT_FILTER || "ALL"}`);
    console.log(`  Bucket:            ${BUCKET}`);
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
            console.error(`❌ Client not found: "${CLIENT_FILTER}"`);
            process.exit(1);
        }
        whereClause.clientId = client.id;
        console.log(`📌 Filtering for client: ${client.companyName || client.name}\n`);
    }

    const tasks = await prisma.task.findMany({
        where: whereClause,
        select: {
            id: true,
            title: true,
            outputFolderId: true,
            driveLinks: true,
            client: {
                select: { name: true, companyName: true },
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

    console.log(`📋 Found ${tasks.length} tasks total\n`);

    let alreadyFlat       = 0;
    let toRevert          = 0;
    let reverted          = 0;
    let s3ObjectsMoved    = 0;
    let dbRecordsUpdated  = 0;
    let backfillReverted  = 0;
    let errors            = 0;

    if (!REVERT_MIGRATE) {
        console.log("⬛ Skipping S3/migrate revert (--revert-migrate not set)\n");
    }

    if (REVERT_MIGRATE) for (const task of tasks) {
        const currentPath = task.outputFolderId!;

        // Skip if NOT in monthly folder format (already flat)
        if (!isMonthlyPath(currentPath)) {
            alreadyFlat++;
            continue;
        }

        const originalPath = getOriginalPath(currentPath);
        if (!originalPath) {
            console.warn(`  ⚠️ Could not parse monthly path: ${currentPath}`);
            continue;
        }

        toRevert++;

        console.log(`\n─── Task ${toRevert}: ${task.title || task.id} ───`);
        console.log(`  Current:  ${currentPath}`);
        console.log(`  Revert→:  ${originalPath}`);

        if (!EXECUTE) {
            // Dry run
            try {
                const s3Objects = await listAllObjects(currentPath);
                console.log(`  S3 objects: ${s3Objects.length}`);
                if (VERBOSE) {
                    for (const key of s3Objects.slice(0, 5)) console.log(`    → ${key}`);
                    if (s3Objects.length > 5) console.log(`    ... and ${s3Objects.length - 5} more`);
                }
            } catch {
                console.log(`  S3 objects: (could not list)`);
            }
            continue;
        }

        // ─── EXECUTE MODE ───
        try {
            // 1. List all S3 objects under the monthly path
            const s3Objects = await listAllObjects(currentPath);
            console.log(`  S3 objects to move: ${s3Objects.length}`);

            if (s3Objects.length === 0) {
                console.log(`  ℹ️ No S3 objects found, updating DB only`);
            }

            // 2. Copy each object to the flat path
            for (const sourceKey of s3Objects) {
                const relativePath = sourceKey.replace(currentPath, "");
                const destKey = `${originalPath}${relativePath}`;

                try {
                    await copyS3Object(sourceKey, destKey);
                    s3ObjectsMoved++;
                    console.log(`  ✅ Copied: ${relativePath}`);
                } catch (err: any) {
                    console.error(`  ❌ Failed to copy: ${sourceKey} → ${destKey}: ${err.message}`);
                    errors++;
                }
            }

            // 3. Update Task.outputFolderId + driveLinks
            const updatedDriveLinks = (task.driveLinks || []).map((link: string) =>
                link.replace(currentPath, originalPath)
            );
            await prisma.task.update({
                where: { id: task.id },
                data: {
                    outputFolderId: originalPath,
                    monthFolder: null,          // also clear monthFolder while we're here
                    driveLinks: updatedDriveLinks,
                },
            });
            dbRecordsUpdated++;
            console.log(`  ✅ Task.outputFolderId + monthFolder + driveLinks reverted`);

            // 4. Update File records (s3Key and url)
            for (const file of task.files) {
                if (!file.s3Key) continue;

                if (file.s3Key.startsWith(currentPath)) {
                    const newS3Key = file.s3Key.replace(currentPath, originalPath);
                    const newUrl = file.url.replace(currentPath, originalPath);

                    await prisma.file.update({
                        where: { id: file.id },
                        data: {
                            s3Key: newS3Key,
                            url: newUrl,
                        },
                    });
                    dbRecordsUpdated++;
                    console.log(`  ✅ File reverted: ${file.name}`);
                }
            }

            // 5. Delete monthly-path S3 objects
            console.log(`  🗑️ Cleaning up ${s3Objects.length} monthly-path objects...`);
            for (const sourceKey of s3Objects) {
                try {
                    await deleteS3Object(sourceKey);
                } catch (err: any) {
                    console.error(`  ⚠️ Failed to delete: ${sourceKey}: ${err.message}`);
                }
            }

            reverted++;
            console.log(`  ✅ Revert complete for this task`);
        } catch (err: any) {
            console.error(`  ❌ FAILED: ${err.message}`);
            errors++;
        }
    }

    // ══════════════════════════════════════
    // PART 2: Revert backfill-month-folder
    // ══════════════════════════════════════
    if (REVERT_BACKFILL) {
        console.log("\n─────────────────────────────────────────────────────");
        console.log("  PART 2: Revert Backfill (monthFolder → NULL)");
        console.log("─────────────────────────────────────────────────────\n");

        const tasksWithMonth = await prisma.task.findMany({
            where: {
                ...(CLIENT_FILTER ? { clientId: tasks[0]?.files ? undefined : undefined } : {}),
                ...whereClause,
                monthFolder: { not: null },
            },
            select: { id: true, title: true, monthFolder: true },
        });

        console.log(`📋 Found ${tasksWithMonth.length} tasks with monthFolder set\n`);

        if (tasksWithMonth.length > 0) {
            // Show distribution
            const dist: Record<string, number> = {};
            for (const t of tasksWithMonth) {
                const m = t.monthFolder!;
                dist[m] = (dist[m] || 0) + 1;
            }
            for (const [month, count] of Object.entries(dist).sort()) {
                console.log(`  ${month.padEnd(22)}: ${count} tasks`);
            }
            console.log();

            if (!EXECUTE) {
                console.log(`  Would set monthFolder = NULL on ${tasksWithMonth.length} tasks`);
            } else {
                const BATCH = 500;
                for (let i = 0; i < tasksWithMonth.length; i += BATCH) {
                    const batch = tasksWithMonth.slice(i, i + BATCH);
                    const updates = batch.map((t) =>
                        prisma.task.update({
                            where: { id: t.id },
                            data: { monthFolder: null },
                        })
                    );
                    try {
                        await prisma.$transaction(updates);
                        backfillReverted += batch.length;
                        console.log(`  ✅ Batch ${Math.floor(i / BATCH) + 1}: cleared monthFolder on ${batch.length} tasks`);
                    } catch (err: any) {
                        console.error(`  ❌ Batch failed: ${err.message}`);
                        errors++;
                    }
                }
            }
        }
    }

    // ── Summary ──
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  REVERT SUMMARY");
    console.log("═══════════════════════════════════════════════════════");
    if (REVERT_MIGRATE) {
        console.log(`  Already flat (skipped):   ${alreadyFlat}`);
        console.log(`  Tasks ${EXECUTE ? "reverted" : "to revert"}:        ${EXECUTE ? reverted : toRevert}`);
        console.log(`  S3 objects moved back:    ${s3ObjectsMoved}`);
        console.log(`  DB records updated:       ${dbRecordsUpdated}`);
    }
    if (REVERT_BACKFILL) {
        console.log(`  monthFolder cleared:      ${EXECUTE ? backfillReverted : "(dry run)"}`);
    }
    console.log(`  Errors:                   ${errors}`);
    console.log("═══════════════════════════════════════════════════════\n");

    if (!EXECUTE) {
        console.log("👆 This was a DRY RUN. No changes were made.");
        console.log("   Add --execute to apply changes.\n");
    }

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error("❌ Revert failed:", err);
    prisma.$disconnect();
    process.exit(1);
});
