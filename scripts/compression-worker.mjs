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
  const required = [
    'REDIS_URL',
    'R2_BUCKET_NAME',
    'R2_ENDPOINT',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Please set these in .env');
    process.exit(1);
  }

  // Try compiled version first
  try {
    const module = await import('../dist/lib/video-compression/worker.js');
    // const module = await import('../dist/lib/video-compression/worker.js');
    await module.startWorker();
  } catch (e) {
    console.log('Compiled version not found, trying ts-node...');

    try {
      // Register ts-node for ESM
      await import('ts-node/register');

      const module = await import('../src/lib/video-compression/worker.js');
      // const module = await import('../src/lib/video-compression/worker.ts');
      await module.startWorker();
    } catch (err) {
      console.error('Failed to start worker:', err);
      process.exit(1);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...');
  process.exit(0);
});

main().catch((err) => {
  console.error('Worker error:', err);
  process.exit(1);
});