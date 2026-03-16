import 'dotenv/config';
import { getS3, BUCKET } from '../src/lib/s3.ts';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

async function testDownload() {
  const fileId = 'DUMMY';
  // Use a key we KNOW exists from the previous list
  const key = 'Testing Client/outputs/March-2026/TestingClient_03-01-2026_LF1/1773414368431-Hair_Oil_Advertisement_Video_Generated.mp4'; 
  
  console.log(`📡 Testing download for key: "${key}" from bucket: "${BUCKET}"`);
  
  const s3 = getS3();
  try {
    const { Body, ContentType, ContentLength } = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    
    console.log(`✅ Connection successful!`);
    console.log(`- Type: ${ContentType}`);
    console.log(`- Size: ${ContentLength} bytes`);
    
    const tempFile = path.join(process.cwd(), 'temp_test_download.mp4');
    const writeStream = fs.createWriteStream(tempFile);
    
    console.log('⏳ Streaming to local file...');
    await new Promise((resolve, reject) => {
      (Body as any).pipe(writeStream)
        .on('finish', () => {
          console.log(`✅ Download finished: ${tempFile}`);
          resolve(true);
        })
        .on('error', reject);
    });
    
    // Cleanup
    // fs.unlinkSync(tempFile);
  } catch (err) {
    console.error('❌ Download failed!');
    console.error(`- Error: ${err.message}`);
    console.error(`- Code: ${err.Code || err.name}`);
    if (err.$metadata) console.error(`- Status: ${err.$metadata.httpStatusCode}`);
  }
}

testDownload();
