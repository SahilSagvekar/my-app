import 'dotenv/config';
import { getS3 } from '../src/lib/s3.ts';
import { ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import fs from 'fs';

async function checkBuckets() {
  const s3 = getS3();
  const buckets = ['e8-app-r2-prod', 'e8productions', 'e8-app-s3-prod', 'e8-app-s3-bucket', 'e8-app-s3-bucket-staging'];
  const searchPattern = 'Episode16 SF8 revised-1 (1).mp4';
  const results = {};

  console.log(`🔎 Searching for "${searchPattern}"...`);

  for (const bucket of buckets) {
    try {
      results[bucket] = { exists: false, matches: [] };
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      results[bucket].exists = true;

      const res = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: 1000
      }));
      
      const found = res.Contents?.filter(c => c.Key?.includes(searchPattern));
      if (found) {
        results[bucket].matches = found.map(f => f.Key);
      }
    } catch (err) {
      results[bucket].error = err.message;
    }
  }

  fs.writeFileSync('bucket_search_results.json', JSON.stringify(results, null, 2));
  console.log('✅ Search results written to bucket_search_results.json');
}

checkBuckets();
