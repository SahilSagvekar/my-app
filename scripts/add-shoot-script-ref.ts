import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set!');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  console.log('Adding shootScriptRef column to Task table in Neon DB...');
  await sql`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "shootScriptRef" text;`;
  console.log('✅ Column shootScriptRef successfully added to Task table!');
}

run().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
