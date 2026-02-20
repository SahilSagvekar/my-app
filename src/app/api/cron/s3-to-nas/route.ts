// // src/app/api/cron/s3-to-nas/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// import { prisma } from '@/lib/prisma';
// import fs from 'node:fs';
// import path from 'node:path';
// import { pipeline } from 'node:stream/promises';
// import { sendNasArchivalReportEmail } from '@/lib/email';

// const s3Client = new S3Client({
//     region: process.env.AWS_S3_REGION!,
//     credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
//     },
// });

// export const maxDuration = 300; // 5 minute timeout for large batches

// export async function POST(req: NextRequest) {
//     const start = Date.now();
//     try {
//         // 1. Verify Cron Secret
//         const cronSecret = req.headers.get('x-cron-secret');
//         if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
//             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
//         }

//         const { searchParams } = new URL(req.url);
//         const bucket = searchParams.get('bucket') || process.env.AWS_S3_BUCKET!;
//         const dryRun = searchParams.get('dryRun') === 'true';
//         const nasPathBase = process.env.NAS_MOUNT_PATH || '/mnt/nas/s3-backup';

//         console.log(`📦 [NAS Archive] Starting transfer from ${bucket} to ${nasPathBase}`);
//         if (dryRun) console.log('⚠️ [NAS Archive] DRY RUN MODE ENABLED - No deletions or DB updates will occur.');

//         // 2. Calculate Date Range (Previous Month)
//         const now = new Date();
//         const firstOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
//         const firstOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

//         console.log(`📅 [NAS Archive] Archiving files from ${firstOfPrevMonth.toISOString()} to ${firstOfCurrentMonth.toISOString()}`);

//         // 3. List All Objects in /outputs/ across all companies
//         let allObjects: any[] = [];
//         let continuationToken: string | undefined = undefined;

//         do {
//             const listCommand: any = new ListObjectsV2Command({
//                 Bucket: bucket,
//                 ContinuationToken: continuationToken,
//             });

//             const response = await s3Client.send(listCommand) as any;
//             if (response.Contents) {
//                 // Filter: Must be in an 'outputs/' folder and within the date range
//                 const filtered = response.Contents.filter((obj: any) => {
//                     const isOutput = obj.Key?.includes('/outputs/');
//                     const isPrevMonth = obj.LastModified && obj.LastModified >= firstOfPrevMonth && obj.LastModified < firstOfCurrentMonth;
//                     return isOutput && isPrevMonth && !obj.Key?.endsWith('/'); // Skip directory markers
//                 });
//                 allObjects = allObjects.concat(filtered);
//             }
//             continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
//         } while (continuationToken);

//         console.log(`📊 [NAS Archive] Found ${allObjects.length} files to archive.`);

//         const results = {
//             transferred: 0,
//             failed: 0,
//             totalSize: 0,
//             errors: [] as string[],
//             companyStats: {} as Record<string, { count: number, size: number }>
//         };

//         // 4. Process Each File
//         for (const obj of allObjects) {
//             try {
//                 const s3Key = obj.Key!;
//                 const fileSize = obj.Size || 0;
//                 const companyName = s3Key.split('/')[0];

//                 // Build Local NAS Path
//                 const localPath = path.join(nasPathBase, s3Key);
//                 const localDir = path.dirname(localPath);

//                 if (!dryRun) {
//                     // Ensure Directory Exists
//                     if (!fs.existsSync(localDir)) {
//                         fs.mkdirSync(localDir, { recursive: true });
//                     }

//                     // Download from S3
//                     const getCommand = new GetObjectCommand({
//                         Bucket: bucket,
//                         Key: s3Key,
//                     });

//                     const { Body } = await s3Client.send(getCommand);
//                     if (!Body) throw new Error('Empty body from S3');

//                     // Write to NAS
//                     const writeStream = fs.createWriteStream(localPath);
//                     await pipeline(Body as any, writeStream);

//                     // Verify File Size
//                     const stats = fs.statSync(localPath);
//                     if (stats.size !== fileSize) {
//                         throw new Error(`Size mismatch: S3=${fileSize}, NAS=${stats.size}`);
//                     }

//                     // Delete from S3
//                     await s3Client.send(new DeleteObjectCommand({
//                         Bucket: bucket,
//                         Key: s3Key,
//                     }));

//                     // Update Prisma
//                     await prisma.file.updateMany({
//                         where: { s3Key: s3Key },
//                         data: {
//                             archivedToNas: true,
//                             nasArchivedAt: new Date(),
//                             nasPath: localPath,
//                         }
//                     });
//                 }

//                 // track stats
//                 results.transferred++;
//                 results.totalSize += fileSize;
//                 if (!results.companyStats[companyName]) {
//                     results.companyStats[companyName] = { count: 0, size: 0 };
//                 }
//                 results.companyStats[companyName].count++;
//                 results.companyStats[companyName].size += fileSize;

//                 console.log(`✅ [NAS Archive] Moved: ${s3Key} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

//             } catch (err: any) {
//                 results.failed++;
//                 const errorMsg = `${obj.Key}: ${err.message}`;
//                 results.errors.push(errorMsg);
//                 console.error(`❌ [NAS Archive] Failed: ${errorMsg}`);
//             }
//         }

//         // 5. Send Report Email
//         await sendNasArchivalReportEmail({
//             month: firstOfPrevMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
//             results,
//             bucket,
//             dryRun
//         });

//         const duration = Date.now() - start;
//         return NextResponse.json({
//             success: true,
//             duration: `${duration}ms`,
//             summary: results
//         });

//     } catch (error: any) {
//         console.error('❌ [NAS Archive] Critical Error:', error);
//         return NextResponse.json({ error: error.message }, { status: 500 });
//     }
// }
