#!/usr/bin/env node
/**
 * Video Compression Worker Script
 * Run with: node scripts/compression-worker.js
 * Or with PM2: pm2 start scripts/compression-worker.js --name compression-worker
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Since this uses TypeScript modules, we need ts-node or build first
// For production, build first then run the compiled version

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  E8 Productions - Video Compression Worker');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Configuration:');
  console.log('  - Redis URL:', process.env.REDIS_URL ? '✓ Set' : '✗ Missing');
  console.log('  - R2 Bucket:', process.env.R2_BUCKET_NAME ? '✓ Set' : '✗ Missing');
  console.log('  - Spot AMI:', process.env.COMPRESSION_AMI_ID ? '✓ Set' : '✗ Missing');
  console.log('');

  // Check required env vars
  const required = ['REDIS_URL', 'R2_BUCKET_NAME', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Please set these in .env.local');
    process.exit(1);
  }

  // Dynamic import for ESM/TypeScript module
  try {
    // Try compiled version first
    const { startWorker } = require('../dist/lib/video-compression/worker');
    await startWorker();
  } catch (e) {
    console.log('Compiled version not found, trying ts-node...');
    
    // Fall back to ts-node
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs',
      },
    });

    const { startWorker } = require('../src/lib/video-compression/worker');
    await startWorker();
  }
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...');
  process.exit(0);
});

main().catch(err => {
  console.error('Worker error:', err);
  process.exit(1);
});