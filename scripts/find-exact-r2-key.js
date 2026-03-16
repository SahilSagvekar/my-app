import 'dotenv/config';
import { getS3, BUCKET } from '../src/lib/s3.ts';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';

async function listRecent() {
  const s3 = getS3();
  const prefix = 'Testing Client/outputs/March-2026/';
  
  console.log(`🔎 Listing objects in: "${prefix}"`);
  
  try {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix
    }));
    
    if (res.Contents) {
      const keys = res.Contents.map(c => c.Key);
      fs.writeFileSync('r2_keys.json', JSON.stringify(keys, null, 2));
      console.log(`✅ Wrote ${keys.length} keys to r2_keys.json`);
    } else {
      console.log('❌ No objects found.');
    }
  } catch (err) {
    console.error('❌ List failed:', err.message);
  }
}

listRecent();
