/**
 * audit-nas-vs-r2.ts
 *
 * Compares files between Cloudflare R2 and your NAS backup.
 * Reports three categories:
 *   ✅ On both R2 and NAS
 *   ☁️  R2 only (not backed up to NAS yet)
 *   💾  NAS only (deleted from R2 / orphaned)
 *
 * Run:
 *   npx tsx scripts/audit-nas-vs-r2.ts
 *
 * Options (env or flags):
 *   --prefix=ClientName/     Limit scan to a specific R2 prefix
 *   --nas-path=/mnt/nas/...  Override NAS mount path
 *   --output=report.json     Save full results to a JSON file
 *   --summary                Print summary only (no per-file lists)
 *   --r2-only                Only show files missing from NAS (most useful)
 */

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// ─── Config ──────────────────────────────────────────────────────────────────

const BUCKET       = process.env.AWS_S3_BUCKET || 'e8-app-r2-prod';
const NAS_BASE     = process.env.NAS_MOUNT_PATH || '/mnt/nas/s3-backup';
const PREFIX       = getArg('--prefix') || '';
const OUTPUT_FILE  = getArg('--output') || '';
const SUMMARY_ONLY = hasFlag('--summary');
const R2_ONLY_MODE = hasFlag('--r2-only');

const s3 = new S3Client({
  region: 'auto',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  endpoint: process.env.R2_ENDPOINT!,
  forcePathStyle: true,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileEntry {
  key: string;
  sizeBytes: number;
  lastModified?: Date;
}

interface AuditResult {
  onBoth:   FileEntry[];
  r2Only:   FileEntry[];  // In R2 but NOT on NAS — needs backup
  nasOnly:  string[];     // On NAS but NOT in R2 — orphaned or deleted from R2
  stats: {
    totalR2:        number;
    totalNas:       number;
    onBothCount:    number;
    r2OnlyCount:    number;
    nasOnlyCount:   number;
    r2OnlyBytes:    number;
    onBothBytes:    number;
    nasPath:        string;
    bucket:         string;
    prefix:         string;
    scannedAt:      string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getArg(flag: string): string | undefined {
  const arg = process.argv.find(a => a.startsWith(flag + '='));
  return arg ? arg.split('=').slice(1).join('=') : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ─── Step 1: List all keys in R2 ─────────────────────────────────────────────

async function listR2Files(prefix: string): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  let continuationToken: string | undefined;
  let page = 0;

  console.log(`☁️  Scanning R2 bucket: ${BUCKET}${prefix ? ` (prefix: ${prefix})` : ' (all files)'}...`);

  do {
    page++;
    process.stdout.write(`\r   Page ${page} — ${files.length} objects found...`);

    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix || undefined,
      ContinuationToken: continuationToken,
      MaxKeys: 1000,
    }));

    for (const obj of res.Contents || []) {
      if (!obj.Key || obj.Key.endsWith('/')) continue; // skip folder markers
      files.push({
        key: obj.Key,
        sizeBytes: obj.Size || 0,
        lastModified: obj.LastModified,
      });
    }

    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  console.log(`\r   ✅ R2 scan complete — ${files.length} files found.              `);
  return files;
}

// ─── Step 2: Walk NAS directory recursively ───────────────────────────────────

function walkNasDir(dir: string, baseDir: string, result: Set<string>): void {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkNasDir(fullPath, baseDir, result);
    } else if (entry.isFile()) {
      // Convert NAS absolute path back to S3 key
      // NAS path: /mnt/nas/s3-backup/ClientName/outputs/...
      // S3 key:   ClientName/outputs/...
      const relative = path.relative(baseDir, fullPath);
      // Normalize to forward slashes (in case running on Windows-mounted NAS)
      result.add(relative.replace(/\\/g, '/'));
    }
  }
}

function listNasFiles(nasBase: string, prefix: string): Set<string> {
  const scanDir = prefix
    ? path.join(nasBase, prefix.replace(/\/$/, ''))
    : nasBase;

  console.log(`💾 Scanning NAS at: ${scanDir}...`);

  if (!fs.existsSync(nasBase)) {
    console.warn(`⚠️  NAS mount path not found: ${nasBase}`);
    console.warn(`   Is the NAS mounted? Check NAS_MOUNT_PATH env var.`);
    return new Set();
  }

  if (!fs.existsSync(scanDir)) {
    console.warn(`⚠️  NAS prefix path not found: ${scanDir}`);
    return new Set();
  }

  const keys = new Set<string>();
  walkNasDir(scanDir, nasBase, keys);

  console.log(`   ✅ NAS scan complete — ${keys.size} files found.`);
  return keys;
}

// ─── Step 3: Compare ─────────────────────────────────────────────────────────

function compareStorages(r2Files: FileEntry[], nasKeys: Set<string>): AuditResult {
  const onBoth:  FileEntry[] = [];
  const r2Only:  FileEntry[] = [];

  const r2KeySet = new Set(r2Files.map(f => f.key));

  for (const file of r2Files) {
    if (nasKeys.has(file.key)) {
      onBoth.push(file);
    } else {
      r2Only.push(file);
    }
  }

  // Files on NAS that are not in R2
  const nasOnly: string[] = [];
  for (const nasKey of nasKeys) {
    if (!r2KeySet.has(nasKey)) {
      nasOnly.push(nasKey);
    }
  }

  const r2OnlyBytes = r2Only.reduce((s, f) => s + f.sizeBytes, 0);
  const onBothBytes = onBoth.reduce((s, f) => s + f.sizeBytes, 0);

  return {
    onBoth,
    r2Only,
    nasOnly,
    stats: {
      totalR2:      r2Files.length,
      totalNas:     nasKeys.size,
      onBothCount:  onBoth.length,
      r2OnlyCount:  r2Only.length,
      nasOnlyCount: nasOnly.length,
      r2OnlyBytes,
      onBothBytes,
      nasPath:      NAS_BASE,
      bucket:       BUCKET,
      prefix:       PREFIX,
      scannedAt:    new Date().toISOString(),
    },
  };
}

// ─── Step 4: Print report ─────────────────────────────────────────────────────

function printReport(result: AuditResult): void {
  const { stats } = result;

  console.log('\n' + '═'.repeat(60));
  console.log('  📊  NAS vs R2 AUDIT REPORT');
  console.log('═'.repeat(60));
  console.log(`  Bucket     : ${stats.bucket}`);
  console.log(`  NAS path   : ${stats.nasPath}`);
  if (stats.prefix) console.log(`  Prefix     : ${stats.prefix}`);
  console.log(`  Scanned at : ${new Date(stats.scannedAt).toLocaleString()}`);
  console.log('─'.repeat(60));
  console.log(`  Total in R2          : ${stats.totalR2.toLocaleString()} files`);
  console.log(`  Total on NAS         : ${stats.totalNas.toLocaleString()} files`);
  console.log('─'.repeat(60));
  console.log(`  ✅ On BOTH           : ${stats.onBothCount.toLocaleString()} files  (${formatBytes(stats.onBothBytes)})`);
  console.log(`  ☁️  R2 ONLY (no NAS)  : ${stats.r2OnlyCount.toLocaleString()} files  (${formatBytes(stats.r2OnlyBytes)})`);
  console.log(`  💾 NAS ONLY (no R2)  : ${stats.nasOnlyCount.toLocaleString()} files`);
  console.log('═'.repeat(60));

  if (SUMMARY_ONLY) return;

  // ── R2 Only (not backed up) ──
  if (!R2_ONLY_MODE || result.r2Only.length > 0) {
    console.log(`\n☁️  FILES IN R2 BUT NOT ON NAS (${result.r2Only.length} files — need backup)`);
    console.log('─'.repeat(60));

    if (result.r2Only.length === 0) {
      console.log('  (none — fully backed up! 🎉)');
    } else {
      // Group by top-level company folder
      const byCompany: Record<string, FileEntry[]> = {};
      for (const f of result.r2Only) {
        const company = f.key.split('/')[0] || 'Unknown';
        if (!byCompany[company]) byCompany[company] = [];
        byCompany[company].push(f);
      }

      for (const [company, files] of Object.entries(byCompany).sort()) {
        const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0);
        console.log(`\n  📁 ${company}  (${files.length} files, ${formatBytes(totalSize)})`);
        for (const f of files.slice(0, 20)) {
          console.log(`     • ${f.key.padEnd(70)} ${formatBytes(f.sizeBytes)}`);
        }
        if (files.length > 20) {
          console.log(`     ... and ${files.length - 20} more`);
        }
      }
    }
  }

  if (R2_ONLY_MODE) return;

  // ── NAS Only (orphaned) ──
  if (result.nasOnly.length > 0) {
    console.log(`\n💾 FILES ON NAS BUT NOT IN R2 (${result.nasOnly.length} files — orphaned/archived)`);
    console.log('─'.repeat(60));
    for (const key of result.nasOnly.slice(0, 50)) {
      console.log(`  • ${key}`);
    }
    if (result.nasOnly.length > 50) {
      console.log(`  ... and ${result.nasOnly.length - 50} more`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 E8 Productions — NAS vs R2 Storage Audit');
  console.log(`   Bucket : ${BUCKET}`);
  console.log(`   NAS    : ${NAS_BASE}`);
  if (PREFIX) console.log(`   Prefix : ${PREFIX}`);
  console.log('');

  // Scan both in parallel
  const [r2Files, nasKeys] = await Promise.all([
    listR2Files(PREFIX),
    Promise.resolve(listNasFiles(NAS_BASE, PREFIX)),
  ]);

  console.log('\n⚙️  Comparing...');
  const result = compareStorages(r2Files, nasKeys);

  printReport(result);

  // Save JSON report if requested
  if (OUTPUT_FILE) {
    const output = {
      stats: result.stats,
      r2Only: result.r2Only.map(f => ({
        key: f.key,
        sizeBytes: f.sizeBytes,
        sizeMB: parseFloat((f.sizeBytes / 1024 / 1024).toFixed(2)),
        lastModified: f.lastModified?.toISOString(),
      })),
      nasOnly: result.nasOnly,
      onBoth: result.onBoth.map(f => ({
        key: f.key,
        sizeBytes: f.sizeBytes,
        sizeMB: parseFloat((f.sizeBytes / 1024 / 1024).toFixed(2)),
      })),
    };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    console.log(`\n📄 Full report saved to: ${OUTPUT_FILE}`);
  }

  console.log('\nDone.\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});