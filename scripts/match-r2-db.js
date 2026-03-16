import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const r2Keys = JSON.parse(fs.readFileSync('r2_keys.json', 'utf8'));
  console.log(`🔎 Checking ${r2Keys.length} keys against database...`);

  for (const key of r2Keys) {
    if (key.endsWith('/')) continue; // Skip folders
    
    const file = await prisma.file.findFirst({
      where: { s3Key: key }
    });

    if (file) {
      console.log('✅ MATCH FOUND:');
      console.log(`- ID: ${file.id}`);
      console.log(`- Key: ${file.s3Key}`);
      console.log(`- Name: ${file.name}`);
      console.log(`- Mime: ${file.mimeType}`);
      
      if (file.mimeType?.startsWith('video/')) {
        console.log('🔥 THIS IS A VALID VIDEO FOR TESTING!');
        // Write to a special file for the next step
        fs.writeFileSync('valid_test_file.json', JSON.stringify(file, null, 2));
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
