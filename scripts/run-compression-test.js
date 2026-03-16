import 'dotenv/config';
import { optimizeVideo } from '../src/lib/video-optimizer.ts';

// The ID found in the previous step
const TEST_FILE_ID = 'cmmq5wn7s0005onro68wdn32q'; 

async function test() {
  console.log(`🧪 Starting compression test for file ID: ${TEST_FILE_ID}...`);
  console.log('⏳ This may take a minute depending on your CPU...');
  
  const startTime = Date.now();
  const result = await optimizeVideo(TEST_FILE_ID);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  if (result.success) {
    console.log(`\n✅ SUCCESS! Compression completed in ${duration}s`);
    console.log(`🔗 Optimized URL: ${result.url}`);
  } else {
    console.log(`\n❌ FAILED! Error: ${result.error}`);
  }
}

test().catch(console.error);
