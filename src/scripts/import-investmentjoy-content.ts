/**
 * Import SF & SQF content for InvestmentJoy client
 * Run: npx tsx scripts/import-investmentjoy-content.ts
 */

import { PrismaClient } from '@prisma/client';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

const CLIENT_ID = 'cmk2cv5h00000onns7v2wnjbe'; // InvestmentJoy
const ASSIGNED_TO = 68; // Fixed user ID

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_PATH = path.join(__dirname, '../../SF_SQF_Link.xlsx');

interface ContentRow {
  link: string;
  title: string;
  folder?: number;
  scheduledDate?: Date;
  deliverableType: 'Short Form Videos' | 'Square Form Videos';
}
 
// Parse Excel date (can be number or string)
function parseExcelDate(value: any): Date | undefined {
  if (!value) return undefined;
  
  // If it's an Excel serial number
  if (typeof value === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return isNaN(date.getTime()) ? undefined : date;
  }
  
  // If it's a string date
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }
  
  // If it's already a Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }
  
  return undefined;
}
 
async function parseExcel(): Promise<ContentRow[]> {
  const workbook = XLSX.readFile(FILE_PATH);
  const rows: ContentRow[] = [];
 
  // Parse SF sheet - columns: Content Link (0), Title (1), Scheduled (2)
  const sfSheet = workbook.Sheets['SF'];
  if (sfSheet) {
    const sfData = XLSX.utils.sheet_to_json(sfSheet, { header: 1 }) as any[][];
    for (let i = 1; i < sfData.length; i++) {
      const row = sfData[i];
      if (row[0] && row[1]) {
        rows.push({
          link: String(row[0]).trim(),
          title: String(row[1]).trim(),
          scheduledDate: parseExcelDate(row[2]),
          deliverableType: 'Short Form Videos',
        });
      }
    }
  }
 
  // Parse SQF sheet - columns: Content Link (0), Folder (1), Title (2), Scheduled (3)
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
          scheduledDate: parseExcelDate(row[3]),
          deliverableType: 'Square Form Videos',
        });
      }
    }
  }
 
  return rows;
}
 
async function importContent() {
  console.log('Starting import...');
 
  // Verify client exists
  const client = await prisma.client.findUnique({
    where: { id: CLIENT_ID },
  });
 
  if (!client) {
    console.error('Client not found:', CLIENT_ID);
    process.exit(1);
  }
 
  console.log('Client found:', client.name);

  // Verify assigned user exists
  const user = await prisma.user.findUnique({
    where: { id: ASSIGNED_TO },
    select: { id: true, name: true }
  });

  if (!user) {
    console.error('User not found with ID:', ASSIGNED_TO);
    process.exit(1);
  }

  console.log(`Assigning to user: ${user.name} (ID: ${ASSIGNED_TO})`);
 
  // Parse Excel
  const rows = await parseExcel();
  console.log(`Parsed ${rows.length} rows`);
  
  // Show date distribution
  const withDates = rows.filter(r => r.scheduledDate).length;
  console.log(`Rows with scheduled dates: ${withDates}/${rows.length}`);
 
  // Import in batches
  const BATCH_SIZE = 100;
  let created = 0;
  let errors = 0;
 
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
 
    const tasks = batch.map((row) => ({
      title: row.title.substring(0, 255),
      description: row.folder ? `Folder: ${row.folder}` : 'Imported from spreadsheet',
      status: 'POSTED' as const,
      deliverableType: row.deliverableType,
      clientId: CLIENT_ID,
      assignedTo: ASSIGNED_TO,
      dueDate: row.scheduledDate || new Date(),
      suggestedTitles: [row.title],
      // Store link in driveLinks array (simpler, more reliable)
      driveLinks: [row.link],
      // Also store in socialMediaLinks as proper JSON array
      socialMediaLinks: [
        {
          platform: 'Google Drive',
          url: row.link,
          postedAt: row.scheduledDate?.toISOString() || new Date().toISOString(),
        },
      ],
      createdAt: row.scheduledDate || new Date(),
      updatedAt: new Date(),
    }));
 
    try {
      await prisma.task.createMany({
        data: tasks,
        skipDuplicates: true,
      });
      created += batch.length;
      console.log(`Progress: ${created}/${rows.length}`);
    } catch (err) {
      console.error('Batch error:', err);
      errors += batch.length;
    }
  }
 
  console.log('\n=== DONE ===');
  console.log(`Created: ${created}`);
  console.log(`Errors: ${errors}`);
}
 
importContent()
  .catch(console.error)
  .finally(() => prisma.$disconnect());