import 'dotenv/config';
import { getS3, BUCKET } from '../src/lib/s3.ts';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';

async function findKey() {
  const s3 = getS3();
  const searchPattern = 'Episode16 SF8 revised-1 (1).mp4';
  
  console.log(`🔎 Searching for objects containing: "${searchPattern}"`);
  
  let isTruncated = true;
  let continuationToken;
  let matches = [];

  try {
    while (isTruncated) {
      const res = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        ContinuationToken: continuationToken
      }));
      
      const found = res.Contents?.filter(c => c.Key?.includes(searchPattern));
      if (found) matches.push(...found.map(f => f.Key));
      
      isTruncated = res.IsTruncated;
      continuationToken = res.NextContinuationToken;
      console.log(`... checked ${res.KeyCount} more objects (Current matches: ${matches.length})`);
    }
    
    if (matches.length > 0) {
      console.log('✅ Matches found:');
      matches.forEach(m => console.log(`  - ${m}`));
      fs.writeFileSync('r2_matches.json', JSON.stringify(matches, null, 2));
    } else {
      console.log('❌ No matches found in the entire bucket.');
    }
  } catch (err) {
    console.error('❌ Search failed:', err.message);
  }
}

findKey();
