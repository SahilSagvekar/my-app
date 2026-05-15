export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { HeadObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET } from '@/lib/s3';
import { requireAdmin } from '@/lib/auth';

const s3 = getS3();

// ─── Deliverable type → short code (matches recurring/run exactly) ───────────
function getShortCode(type: string): string {
  const n = type.toLowerCase().trim();
  if (n === 'short form videos')        return 'SF';
  if (n === 'long form videos')         return 'LF';
  if (n === 'square form videos')       return 'SQF';
  if (n === 'thumbnails')               return 'THUMB';
  if (n === 'tiles')                    return 'T';
  if (n === 'hard posts / graphic images') return 'HP';
  if (n === 'snapchat episodes')        return 'SEP';
  if (n === 'beta short form')          return 'BSF';
  return type.replace(/\s+/g, '');
}

// ─── Check if an R2 "folder" key exists ──────────────────────────────────────
// R2 folders are zero-byte objects ending in '/'. We check two ways:
//   1. HeadObject on the exact key (the zero-byte folder marker)
//   2. ListObjectsV2 with the prefix — if anything is inside, the folder exists
async function folderExists(key: string): Promise<boolean> {
  const prefix = key.endsWith('/') ? key : `${key}/`;
  try {
    // Fast path: check for the explicit marker object
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: prefix }));
    return true;
  } catch {
    // Slow path: see if any objects exist under this prefix
    try {
      const res = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        MaxKeys: 1,
      }));
      return (res.Contents?.length ?? 0) > 0 || (res.CommonPrefixes?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }
}

// ─── Create a folder marker in R2 ────────────────────────────────────────────
async function createFolder(key: string): Promise<void> {
  const prefix = key.endsWith('/') ? key : `${key}/`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: prefix,
    ContentType: 'application/x-directory',
    Body: '',
  }));
}

// ─── Build the expected folder list for one client ───────────────────────────
// Expected structure for each active client:
//   CompanyName/
//   CompanyName/raw-footage/
//   CompanyName/elements/
//   CompanyName/outputs/
//   For each distinct monthFolder found in tasks:
//     CompanyName/raw-footage/<Month-Year>/
//     CompanyName/outputs/<Month-Year>/
//     For each monthly deliverable type the client has:
//       CompanyName/raw-footage/<Month-Year>/<ShortCode>/
interface ExpectedFolder {
  key: string;           // full R2 key with trailing slash
  label: string;         // human-readable description
  clientId: string;
  companyName: string;
}

async function buildExpectedFolders(): Promise<ExpectedFolder[]> {
  const clients = await prisma.client.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      companyName: true,
      monthlyDeliverables: { select: { type: true } },
    },
    orderBy: { name: 'asc' },
  });

  // Get all distinct monthFolders that have tasks (tells us which months existed)
  const monthRows = await prisma.task.findMany({
    where: { monthFolder: { not: null } },
    select: { monthFolder: true, clientId: true },
    distinct: ['monthFolder', 'clientId'],
    orderBy: { monthFolder: 'desc' },
  });

  // Build a map: clientId → Set<monthFolder>
  const clientMonths = new Map<string, Set<string>>();
  for (const row of monthRows) {
    if (!row.clientId || !row.monthFolder) continue;
    if (!clientMonths.has(row.clientId)) clientMonths.set(row.clientId, new Set());
    clientMonths.get(row.clientId)!.add(row.monthFolder);
  }

  // Always include the current + next month for every active client
  const now = new Date();
  const currentMonth = now.toLocaleDateString('en-US', { month: 'long' }) + '-' + now.getFullYear();
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = nextDate.toLocaleDateString('en-US', { month: 'long' }) + '-' + nextDate.getFullYear();

  const expected: ExpectedFolder[] = [];

  for (const client of clients) {
    const company = (client.companyName || client.name).trim();

    // Top-level folders
    expected.push({ key: `${company}/`,             label: 'Root folder',        clientId: client.id, companyName: company });
    expected.push({ key: `${company}/raw-footage/`, label: 'raw-footage root',   clientId: client.id, companyName: company });
    expected.push({ key: `${company}/elements/`,    label: 'elements root',      clientId: client.id, companyName: company });
    expected.push({ key: `${company}/outputs/`,     label: 'outputs root',       clientId: client.id, companyName: company });

    // Per-month folders
    const months = new Set([
      ...(clientMonths.get(client.id) ?? []),
      currentMonth,
      nextMonth,
    ]);

    const deliverableShortCodes = [
      ...new Set(client.monthlyDeliverables.map(d => getShortCode(d.type))),
    ];

    for (const month of months) {
      expected.push({
        key: `${company}/raw-footage/${month}/`,
        label: `raw-footage/${month}`,
        clientId: client.id,
        companyName: company,
      });
      expected.push({
        key: `${company}/outputs/${month}/`,
        label: `outputs/${month}`,
        clientId: client.id,
        companyName: company,
      });

      // Deliverable sub-folders inside raw-footage (the main gap)
      for (const code of deliverableShortCodes) {
        expected.push({
          key: `${company}/raw-footage/${month}/${code}/`,
          label: `raw-footage/${month}/${code}`,
          clientId: client.id,
          companyName: company,
        });
      }
    }
  }

  return expected;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/repair-folders
// Scans all expected folders and returns which are missing — does NOT create anything
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const expected = await buildExpectedFolders();

    // Check all in parallel with concurrency cap to avoid R2 rate limits
    const CONCURRENCY = 20;
    const missing: ExpectedFolder[] = [];
    const present: ExpectedFolder[] = [];

    for (let i = 0; i < expected.length; i += CONCURRENCY) {
      const batch = expected.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(f => folderExists(f.key)));
      batch.forEach((f, idx) => {
        if (results[idx]) present.push(f);
        else missing.push(f);
      });
    }

    // Group missing by client for the UI
    const byClient: Record<string, { companyName: string; missing: { key: string; label: string }[] }> = {};
    for (const f of missing) {
      if (!byClient[f.clientId]) byClient[f.clientId] = { companyName: f.companyName, missing: [] };
      byClient[f.clientId].missing.push({ key: f.key, label: f.label });
    }

    return NextResponse.json({
      scanned: expected.length,
      presentCount: present.length,
      missingCount: missing.length,
      byClient,
    });
  } catch (err: any) {
    console.error('repair-folders GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/repair-folders
// Body: { keys: string[] }  — creates only the folders you explicitly pass
// Returns per-key success/failure so the UI can update individually
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { keys }: { keys: string[] } = await req.json();

    if (!Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ error: 'keys must be a non-empty array' }, { status: 400 });
    }

    // Safety: only allow keys that look like valid R2 folder paths (no traversal)
    const safe = keys.filter(k => typeof k === 'string' && !k.includes('..') && k.endsWith('/'));
    if (safe.length !== keys.length) {
      return NextResponse.json({ error: 'One or more keys are invalid' }, { status: 400 });
    }

    const results: { key: string; ok: boolean; error?: string }[] = [];

    // Create folders with concurrency cap
    const CONCURRENCY = 10;
    for (let i = 0; i < safe.length; i += CONCURRENCY) {
      const batch = safe.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(batch.map(key => createFolder(key)));
      settled.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          results.push({ key: batch[idx], ok: true });
        } else {
          results.push({ key: batch[idx], ok: false, error: (result.reason as Error).message });
        }
      });
    }

    const created = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;

    return NextResponse.json({ created, failed, results });
  } catch (err: any) {
    console.error('repair-folders POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}