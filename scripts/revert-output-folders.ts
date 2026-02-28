/**
 * REVERT: Move task output folders BACK from monthly subfolders to flat structure.
 *
 * This reverses the migration:
 *   FROM: CompanyName/outputs/February-2026/TaskTitle/
 *   TO:   CompanyName/outputs/TaskTitle/
 *
 * Usage:
 *     npx tsx scripts/revert-output-folders.ts                              (dry run, all clients)
 *     npx tsx scripts/revert-output-folders.ts --client "CompanyName"       (dry run, one client)
 *     npx tsx scripts/revert-output-folders.ts --execute                    (real, all clients)
 *     npx tsx scripts/revert-output-folders.ts --execute --client "Name"    (real, one client)
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
const EXECUTE = process.argv.includes("--execute");
const CLIENT_FILTER = process.argv.find((a) => a === "--client")
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
    console.log("  REVERT: Remove Monthly Subfolders → Flat Structure");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Mode:   ${EXECUTE ? "🔴 EXECUTE (real changes)" : "🟢 DRY RUN (no changes)"}`);
    console.log(`  Client: ${CLIENT_FILTER || "ALL"}`);
    console.log(`  Bucket: ${BUCKET}`);
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

    let alreadyFlat = 0;
    let toRevert = 0;
    let reverted = 0;
    let s3ObjectsMoved = 0;
    let dbRecordsUpdated = 0;
    let errors = 0;

    for (const task of tasks) {
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
                    driveLinks: updatedDriveLinks,
                },
            });
            dbRecordsUpdated++;
            console.log(`  ✅ Task.outputFolderId + driveLinks reverted`);

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

    // Summary
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  REVERT SUMMARY");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  Already flat:     ${alreadyFlat}`);
    console.log(`  ${EXECUTE ? "Reverted" : "To revert"}:       ${EXECUTE ? reverted : toRevert}`);
    console.log(`  S3 objects moved:  ${s3ObjectsMoved}`);
    console.log(`  DB records updated:${dbRecordsUpdated}`);
    console.log(`  Errors:            ${errors}`);
    console.log("═══════════════════════════════════════════════════════\n");

    if (!EXECUTE && toRevert > 0) {
        console.log("👆 This was a DRY RUN. To apply changes, add --execute\n");
    }

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error("❌ Revert failed:", err);
    prisma.$disconnect();
    process.exit(1);
});
