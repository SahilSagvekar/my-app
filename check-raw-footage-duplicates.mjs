// check-raw-footage-duplicates.mjs
//
// Scans a client's ENTIRE raw-footage folder in R2 — recursively, every
// subfolder, no depth limit — and tells you which filenames from a list
// you provide are NOT already uploaded (i.e. still need uploading).
//
// Usage:
//   node check-raw-footage-duplicates.mjs "MissBehaveTV" filenames.txt
//
// filenames.txt = one filename per line (the list you paste from your
// camera card / local folder). Matching is by filename only (not full
// path), case-insensitive.
//
// Run this from the my-app repo root — it needs the same .env
// (FILE_SERVER_URL, FILE_SERVER_SECRET, DATABASE_URL) the app uses.

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import 'dotenv/config';

const prisma = new PrismaClient();

const FILE_SERVER_URL = process.env.FILE_SERVER_URL || 'http://localhost:4000';
const FILE_SERVER_SECRET = process.env.FILE_SERVER_SECRET || '';

const clientNameArg = process.argv[2];
const filenamesFileArg = process.argv[3];

if (!clientNameArg || !filenamesFileArg) {
  console.error('Usage: node check-raw-footage-duplicates.mjs "<Client Name>" <filenames.txt>');
  process.exit(1);
}

if (!fs.existsSync(filenamesFileArg)) {
  console.error(`❌ File not found: ${filenamesFileArg}`);
  process.exit(1);
}

const wantedFilenames = fs.readFileSync(filenamesFileArg, 'utf8')
  .split('\n')
  .map(l => l.trim())
  .filter(Boolean);

console.log(`📋 ${wantedFilenames.length} filenames to check\n`);

// ── 1. Find the client (case-insensitive, partial match) ──────────────────
const client = await prisma.client.findFirst({
  where: {
    OR: [
      { companyName: { contains: clientNameArg, mode: 'insensitive' } },
      { name: { contains: clientNameArg, mode: 'insensitive' } },
    ],
  },
  select: { id: true, companyName: true, name: true },
});

if (!client) {
  console.error(`❌ No client found matching "${clientNameArg}"`);
  await prisma.$disconnect();
  process.exit(1);
}

const companyName = client.companyName || client.name;
console.log(`✅ Matched client: "${companyName}" (id: ${client.id})\n`);

// ── 2. Pull the full raw-footage tree from the file server ────────────────
const prefix = `${companyName}/raw-footage/`;
console.log(`🔍 Scanning R2 recursively under: ${prefix}\n`);

const token = jwt.sign({ userId: 'script', role: 'admin' }, FILE_SERVER_SECRET, { expiresIn: '5m' });

const url = new URL('/structure', FILE_SERVER_URL);
url.searchParams.set('prefix', prefix);
url.searchParams.set('role', 'admin');

const res = await fetch(url.toString(), {
  headers: { Authorization: `Bearer ${token}` },
});

if (!res.ok) {
  console.error(`❌ File server error: ${res.status} ${await res.text().catch(() => '')}`);
  await prisma.$disconnect();
  process.exit(1);
}

const tree = await res.json();

// ── 3. Flatten the tree — collect every file's name, however deeply nested ─
const existingFilenames = new Set();

function walk(node) {
  if (!node) return;
  if (node.type === 'file') {
    existingFilenames.add(node.name.toLowerCase());
  } else if (node.children) {
    for (const child of node.children) walk(child);
  }
}
walk(tree);

console.log(`📦 Found ${existingFilenames.size} existing files in raw-footage (all subfolders)\n`);

// ── 4. Diff ─────────────────────────────────────────────────────────────
const missing = [];
const alreadyThere = [];

for (const fname of wantedFilenames) {
  if (existingFilenames.has(fname.toLowerCase())) {
    alreadyThere.push(fname);
  } else {
    missing.push(fname);
  }
}

console.log(`\n=== RESULTS ===`);
console.log(`✅ Already uploaded (${alreadyThere.length}):`);
alreadyThere.forEach(f => console.log(`   ${f}`));

console.log(`\n🆕 NOT uploaded yet — need to upload (${missing.length}):`);
missing.forEach(f => console.log(`   ${f}`));

// Also write the "need to upload" list to a file for convenience
if (missing.length > 0) {
  fs.writeFileSync('files-to-upload.txt', missing.join('\n'));
  console.log(`\n💾 Wrote the ${missing.length} missing filenames to files-to-upload.txt`);
}

await prisma.$disconnect();
