import 'dotenv/config';
import { getS3, BUCKET } from '../src/lib/s3.ts';
import { ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';

async function diagnose() {
  console.log('🔍 Diagnosing R2 for Compression Test...');
  console.log(`- Bucket: ${BUCKET}`);
  
  const s3 = getS3();
  
  try {
    console.log('📡 Testing ListObjectsV2...');
    const listRes = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      MaxKeys: 5
    }));
    console.log('✅ List successful. Top keys:');
    listRes.Contents?.forEach(c => console.log(`  - ${c.Key}`));

    const testKey = 'cmmq5wn7s0005onro68wdn32q'; // Wait, this is the ID, not necessarily the key
    // Let's find the key for ID cmmq5wn7s0005onro68wdn32q from DB first
  } catch (err) {
    console.error('❌ R2 Access Failed:', err.message);
    if (err.Code) console.error(`   Code: ${err.Code}`);
  }
}

diagnose();
