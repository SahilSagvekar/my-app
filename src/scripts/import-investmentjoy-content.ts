/**
 * Import SF & SQF content for InvestmentJoy client
 * Run: npx tsx src/scripts/import-investmentjoy-content.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// ESM fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIG
const CLIENT_ID = 'cmk2cv5h00000onns7v2wnjbe';
const FILE_PATH = path.resolve(__dirname, '../../SF_SQF_Link.xlsx');

interface ContentRow {
  link: string;
  title: string;
  folder?: number;
  deliverableType: 'Short Form Videos' | 'Square Form Videos';
}

async function parseExcel(): Promise<ContentRow[]> {
  const xlsxLib: any = XLSX;

  const workbook = (xlsxLib.readFile || xlsxLib.default?.readFile)(FILE_PATH);

  if (!workbook) {
    throw new Error("XLSX.readFile is not available");
  }

  const rows: ContentRow[] = [];

  // SF sheet
  const sfSheet = workbook.Sheets['SF'];
  if (sfSheet) {
    const sfData = XLSX.utils.sheet_to_json(sfSheet, { header: 1 }) as any[][];
    for (let i = 1; i < sfData.length; i++) {
      const row = sfData[i];
      if (row[0] && row[1]) {
        rows.push({
          link: String(row[0]).trim(),
          title: String(row[1]).trim(),
          deliverableType: 'Short Form Videos',
        });
      }
    }
  }

  // SQF sheet
  const sqfSheet = workbook.Sheets['SQF'];
  if (sqfSheet) {
    const sqfData = XLSX.utils.sheet_to_json(sqfSheet, { header: 1 }) as any[][];
    for (let i = 1; i < sqfData.length; i++) {
      const row = sqfData[i];
      if (row[0] && row[2]) {
        rows.push({
          link: String(row[0]).trim(),
          title: String(row[2]).trim(),
          folder: row[1] ? Number(row[1]) : undefined,
          deliverableType: 'Square Form Videos',
        });
      }
    }
  }

  return rows;
}

async function importContent() {
  console.log('Starting import...');

  // ✅ Verify client
  const client = await prisma.client.findUnique({
    where: { id: CLIENT_ID },
  });

  if (!client) {
    console.error('Client not found:', CLIENT_ID);
    process.exit(1);
  }

  console.log('Client found:', client.name);

  // ✅ Get a valid user (IMPORTANT FIX)
  const user = await prisma.user.findFirst();

  if (!user) {
    throw new Error("No users found in DB. Cannot assign tasks.");
  }

  const ASSIGNED_TO = user.id;
  console.log('Assigning tasks to user ID:', ASSIGNED_TO);

  // ✅ Parse Excel
  const rows = await parseExcel();
  console.log(`Parsed ${rows.length} rows`);

  const BATCH_SIZE = 100;
  let created = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const tasks = batch.map((row) => ({
      title: row.title.substring(0, 255),
      description: row.folder
        ? `Folder: ${row.folder}`
        : 'Imported from spreadsheet',
      status: 'POSTED' as const,
      deliverableType: row.deliverableType,
      clientId: CLIENT_ID,
      assignedTo: ASSIGNED_TO,
      socialMediaLinks: [
        {
          platform: 'Google Drive',
          url: row.link,
          postedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    try {
      await prisma.task.createMany({
        data: tasks,
        skipDuplicates: true,
      });

      created += batch.length;
      console.log(`Progress: ${created}/${rows.length}`);
    } catch (err: any) {
      console.error('Batch error:', err?.meta || err);
      errors += batch.length;
    }
  }

  console.log('\n=== DONE ===');
  console.log(`Created: ${created}`);
  console.log(`Errors: ${errors}`);
}

importContent()
  .catch((err) => {
    console.error('Fatal error:', err);
  })
  .finally(() => prisma.$disconnect());