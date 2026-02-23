import { PrismaClient, TaskStatus } from "@prisma/client";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
});

const BUCKET = process.env.AWS_S3_BUCKET || "e8-app-s3-prod";

// --- Helpers for correct file metadata ---
function getMimeTypeFromName(name: string): string | null {
    const ext = name.split('.').pop()?.toLowerCase();
    if (!ext) return null;
    const map: Record<string, string> = {
        'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo',
        'webm': 'video/webm', 'mkv': 'video/x-matroska',
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'mp3': 'audio/mpeg', 'wav': 'audio/wav',
        'zip': 'application/zip',
    };
    return map[ext] || null;
}

function getSmartFolderType(mimeType: string | null, fileName: string): string {
    if (fileName.toLowerCase().includes('license')) return 'music-license';
    if (mimeType?.startsWith('video/')) return 'main';
    if (mimeType?.startsWith('image/')) return 'thumbnails';
    if (mimeType?.includes('pdf')) return 'music-license';
    return 'main';
}

async function prodRestore() {
    console.log("🚀 Starting Production Restoration for InvestmentJoy...");

    // 1. Find the Client
    const client = await prisma.client.findFirst({
        where: {
            OR: [
                { companyName: { contains: "InvestmentJoy", mode: "insensitive" } },
                { name: { contains: "Brandon Schlicter", mode: "insensitive" } }
            ]
        }
    });

    if (!client) {
        console.error("❌ Could not find InvestmentJoy client in the current database!");
        process.exit(1);
    }

    console.log(`✅ Found Client: ${client.name} (${client.id})`);

    // 2. Find the Deliverable
    const deliverable = await prisma.monthlyDeliverable.findFirst({
        where: { clientId: client.id, type: { contains: "Short Form", mode: "insensitive" } }
    });

    if (!deliverable) {
        console.error("❌ Could not find a Short Form Video deliverable for this client!");
        process.exit(1);
    }

    // 3. Find the Staff members
    const editor = await prisma.user.findFirst({ where: { name: { contains: "Val Almonte", mode: "insensitive" } } });
    const qc = await prisma.user.findFirst({ where: { name: { contains: "Vida", mode: "insensitive" } } });
    const scheduler = await prisma.user.findFirst({ where: { name: { contains: "Mark Ryan Abuda", mode: "insensitive" } } });

    console.log(`👨‍💻 Assigning to: Editor(${editor?.name || "None"}), QC(${qc?.name || "None"}), Scheduler(${scheduler?.name || "None"})`);

    // 4. Scan S3
    const command = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: "InvestmentJoy/outputs/",
    });

    const response = await s3Client.send(command);
    if (!response.Contents) {
        console.log("❌ No files found in S3 outputs folder.");
        return;
    }

    // 5. Group files by Task Folder
    const tasksMap: Record<string, any[]> = {};
    for (const item of response.Contents) {
        const parts = item.Key!.split("/");
        if (parts.length < 3) continue;

        const taskFolderName = parts[2];
        if (!tasksMap[taskFolderName]) {
            tasksMap[taskFolderName] = [];
        }

        if (item.Size && item.Size > 0) {
            tasksMap[taskFolderName].push(item);
        }
    }

    const taskFolders = Object.keys(tasksMap);
    console.log(`📦 Identified ${taskFolders.length} folders in S3.`);

    let restoredCount = 0;

    for (const folderName of taskFolders) {
        const sfNumber = folderName.match(/SF(\d+)/)?.[1];
        if (!sfNumber) continue;

        const correctTitle = `InvestmentJoy_02-02-2026_SF${sfNumber}`;
        const files = tasksMap[folderName];

        try {
            // Create the Task
            const task = await prisma.task.create({
                data: {
                    title: correctTitle,
                    description: "Production Restoration from S3 backup.",
                    status: files.length > 0 ? TaskStatus.READY_FOR_QC : TaskStatus.PENDING,
                    clientId: client.id,
                    clientUserId: client.userId,
                    monthlyDeliverableId: deliverable.id,
                    assignedTo: editor?.id || 39, // Default to admin if not found
                    qc_specialist: qc?.id,
                    scheduler: scheduler?.id,
                    taskType: "Short Form Video",
                    folderType: "outputs",
                }
            });

            // Create File records with correct mimeType and folderType
            for (const fileItem of files) {
                const fileName = fileItem.Key!.split("/").pop() || "unknown";
                const url = `https://${BUCKET}.s3.us-east-1.amazonaws.com/${fileItem.Key}`;
                const mimeType = getMimeTypeFromName(fileName);
                const folderType = getSmartFolderType(mimeType, fileName);

                await prisma.file.create({
                    data: {
                        taskId: task.id,
                        name: fileName,
                        url: url,
                        s3Key: fileItem.Key,
                        size: BigInt(fileItem.Size || 0),
                        mimeType: mimeType,
                        folderType: folderType,
                    }
                });
            }

            restoredCount++;
        } catch (err: any) {
            if (err.code === 'P2002') {
                console.log(`⏭️ Skipping existing task: ${correctTitle}`);
            } else {
                console.error(`❌ Failed to restore ${correctTitle}:`, err.message);
            }
        }
    }

    console.log(`\n✨ Production Restoration Complete!`);
    console.log(`✅ Total Restored: ${restoredCount}`);
}

prodRestore()
    .catch(err => console.error("💥 Critical Failure:", err))
    .finally(() => prisma.$disconnect());
