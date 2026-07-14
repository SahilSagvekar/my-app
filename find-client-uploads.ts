/**
 * find-client-uploads.ts
 *
 * Diagnostic: finds the most recent uploads for a client, checking BOTH
 * places files can live:
 *   1. The `File` table — but this ONLY has rows for task-linked uploads.
 *      Client-side "raw footage" / direct Drive uploads (taskId ==
 *      "drive-upload") never create a File row — see
 *      src/app/api/upload/complete/route.ts, the `isDriveUpload` branch
 *      skips prisma.file.create entirely.
 *   2. The R2 bucket itself, listed live under that client's folder prefix —
 *      this is the actual source of truth for raw-footage/Drive uploads,
 *      since the DriveExplorer UI reads directly from R2, not from Postgres,
 *      for that area.
 *
 * So "it's not showing up in the app" can mean either "never made it to R2"
 * or "made it to R2 but something about listing/caching is hiding it" —
 * this script tells you which, by going straight to R2.
 *
 * Run:
 *   npx tsx src/scripts/find-client-uploads.ts --client="William Coleman"  --prefix=raw-footage
 *
 * Options:
 *   --client="name"     Required. Matches Client.name, Client.companyName,
 *                        Client.email, or the linked User's name/email
 *                        (case-insensitive, partial match)
 *   --limit=20           How many recent items to show from each source (default 20)
 *   --prefix=raw-footage  Only list R2 objects under this subfolder (default: whole client folder)
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

const BUCKET = process.env.AWS_S3_BUCKET || 'e8-app-r2-prod';
const IS_R2 = !!process.env.R2_ENDPOINT;

const s3 = new S3Client({
  region: IS_R2 ? 'auto' : (process.env.AWS_S3_REGION || 'us-east-1'),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  ...(IS_R2 ? { endpoint: process.env.R2_ENDPOINT! } : {}),
});

function getFlag(name: string): string | null {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=').replace(/^"|"$/g, '') : null;
}

function formatBytes(bytes: number | bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

async function main() {
  const clientQuery = getFlag('client');
  const limit = Number(getFlag('limit') || 20);
  const subPrefix = getFlag('prefix'); // e.g. "raw-footage"

  if (!clientQuery) {
    console.error('Usage: npx tsx src/scripts/find-client-uploads.ts --client="name" [--limit=20] [--prefix=raw-footage]');
    process.exit(1);
  }

  console.log(`\n🔍 Looking up client matching "${clientQuery}"...\n`);

  // Match against Client fields directly, OR via a linked portal User account
  // (the client contact's name may live on the User row, not the Client row).
  const client = await prisma.client.findFirst({
    where: {
      OR: [
        { name: { contains: clientQuery, mode: 'insensitive' } },
        { companyName: { contains: clientQuery, mode: 'insensitive' } },
        { email: { contains: clientQuery, mode: 'insensitive' } },
        {
          linkedUsers: {
            some: {
              OR: [
                { name: { contains: clientQuery, mode: 'insensitive' } },
                { email: { contains: clientQuery, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      linkedUsers: { select: { id: true, name: true, email: true } },
    },
  });

  if (!client) {
    console.error(`❌ No client found matching "${clientQuery}". Try a broader search term (e.g. just the last name, or the company name).`);
    process.exit(1);
  }

  const companyFolder = client.companyName || client.name;
  console.log(`✅ Matched client: ${client.name} — company: "${client.companyName || '(none set)'}" — id: ${client.id}`);
  if (client.linkedUsers.length) {
    console.log(`   Linked portal user(s): ${client.linkedUsers.map((u) => `${u.name} <${u.email}>`).join(', ')}`);
  }
  console.log(`   R2 folder prefix used: "${companyFolder}/"\n`);

  // ── 1. DB File records (task-linked uploads only) ─────────────────────────
  console.log(`── DB File records (task-linked uploads only — will be empty for raw-footage/Drive uploads) ──`);
  const dbFiles = await prisma.file.findMany({
    where: { task: { clientId: client.id }, isActive: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { name: true, s3Key: true, size: true, createdAt: true, folderType: true, task: { select: { title: true } } },
  });

  if (dbFiles.length === 0) {
    console.log('   (none found)');
  } else {
    for (const f of dbFiles) {
      console.log(`   ${f.createdAt.toISOString()}  ${formatBytes(f.size)}  ${f.name}  [task: ${f.task.title}]`);
    }
  }

  // ── 2. Live R2 bucket listing (the real source of truth for raw-footage) ──
  const prefix = subPrefix ? `${companyFolder}/${subPrefix}/` : `${companyFolder}/`;
  console.log(`\n── Live R2 listing under "${prefix}" (source of truth for raw-footage/Drive uploads) ──`);

  const allObjects: { key: string; size: number; lastModified: Date }[] = [];
  let continuationToken: string | undefined;
  do {
    const resp = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of resp.Contents || []) {
      if (!obj.Key || obj.Key.endsWith('/')) continue; // skip folder markers
      allObjects.push({ key: obj.Key, size: obj.Size || 0, lastModified: obj.LastModified || new Date(0) });
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  allObjects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

  if (allObjects.length === 0) {
    console.log(`   (no objects found under this prefix — either nothing was ever uploaded here, or the folder name doesn't match "${companyFolder}" exactly. Try --prefix= to widen the search, or check the exact S3 folder name in the Drive UI.)`);
  } else {
    console.log(`   ${allObjects.length} total object(s). Showing ${Math.min(limit, allObjects.length)} most recent:\n`);
    for (const obj of allObjects.slice(0, limit)) {
      console.log(`   ${obj.lastModified.toISOString()}  ${formatBytes(obj.size)}  ${obj.key}`);
    }
  }

  console.log('');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('❌ Script failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});