#!/usr/bin/env npx ts-node

/**
 * 🎬 Batch Video Optimization Script
 * 
 * This script finds all existing video files in the database that haven't been
 * optimized yet and triggers the optimization process for each one.
 * 
 * Usage:
 *   npx ts-node scripts/optimize-existing-videos.ts [options]
 * 
 * Options:
 *   --dry-run       Show what would be optimized without actually doing it
 *   --limit N       Only process N videos (default: all)
 *   --batch N       Process N videos concurrently (default: 2)
 *   --force         Re-optimize even if already completed
 *   --failed-only   Only retry previously failed optimizations
 *   --active-only   Only process active (non-replaced) file versions
 * 
 * Examples:
 *   npx ts-node scripts/optimize-existing-videos.ts --dry-run
 *   npx ts-node scripts/optimize-existing-videos.ts --limit 10 --batch 2
 *   npx ts-node scripts/optimize-existing-videos.ts --failed-only
 *   npx ts-node scripts/optimize-existing-videos.ts --force --limit 5
 */

import { PrismaClient } from '@prisma/client';
import { optimizeVideo } from '@/lib/video-optimizer';

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const FAILED_ONLY = args.includes('--failed-only');
const ACTIVE_ONLY = args.includes('--active-only');

const limitIndex = args.indexOf('--limit');
const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : undefined;

const batchIndex = args.indexOf('--batch');
const BATCH_SIZE = batchIndex !== -1 ? parseInt(args[batchIndex + 1]) : 2;

interface VideoFile {
  id: string;
  name: string;
  url: string;
  s3Key: string | null;
  mimeType: string | null;
  size: bigint;
  optimizationStatus: string;
  optimizationError: string | null;
  isActive: boolean;
  taskId: string;
  createdAt: Date;
}

async function findVideosToOptimize(): Promise<VideoFile[]> {
  console.log('\n🔍 Finding videos to optimize...\n');

  // Build the where clause based on options
  const where: any = {
    mimeType: { startsWith: 'video/' },
    s3Key: { not: null },
  };

  if (ACTIVE_ONLY) {
    where.isActive = true;
  }

  if (FAILED_ONLY) {
    where.optimizationStatus = 'FAILED';
  } else if (!FORCE) {
    // By default, only get videos that haven't been optimized
    where.optimizationStatus = { in: ['NONE', 'FAILED'] };
  }
  // If FORCE is true, we don't filter by status (get all videos)

  const videos = await prisma.file.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: LIMIT,
    select: {
      id: true,
      name: true,
      url: true,
      s3Key: true,
      mimeType: true,
      size: true,
      optimizationStatus: true,
      optimizationError: true,
      isActive: true,
      taskId: true,
      createdAt: true,
    },
  });

  return videos;
}

function formatBytes(bytes: bigint): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = Number(bytes);
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

async function optimizeWithRetry(fileId: string, fileName: string, retries = 2): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`   ⚡ Attempt ${attempt}/${retries}...`);
      const result = await optimizeVideo(fileId);
      
      if (result.success) {
        console.log(`   ✅ Success! Proxy URL: ${result.url}`);
        return true;
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
        if (attempt < retries) {
          console.log(`   ⏳ Retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      if (attempt < retries) {
        console.log(`   ⏳ Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
  return false;
}

async function processBatch(videos: VideoFile[], startIndex: number): Promise<{ success: number; failed: number }> {
  const batch = videos.slice(startIndex, startIndex + BATCH_SIZE);
  const results = await Promise.allSettled(
    batch.map(async (video, idx) => {
      const globalIdx = startIndex + idx + 1;
      console.log(`\n[${globalIdx}/${videos.length}] 🎬 ${video.name}`);
      console.log(`   📁 Size: ${formatBytes(video.size)}`);
      console.log(`   📍 Status: ${video.optimizationStatus}`);
      console.log(`   🔑 Key: ${video.s3Key}`);
      
      if (DRY_RUN) {
        console.log(`   🏃 [DRY RUN] Would optimize this video`);
        return true;
      }
      
      return optimizeWithRetry(video.id, video.name);
    })
  );
  
  let success = 0;
  let failed = 0;
  
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      success++;
    } else {
      failed++;
    }
  });
  
  return { success, failed };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎬 BATCH VIDEO OPTIMIZATION SCRIPT');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📋 Options:`);
  console.log(`   • Dry Run: ${DRY_RUN ? 'YES (no actual optimization)' : 'NO'}`);
  console.log(`   • Force Re-optimize: ${FORCE ? 'YES' : 'NO'}`);
  console.log(`   • Failed Only: ${FAILED_ONLY ? 'YES' : 'NO'}`);
  console.log(`   • Active Only: ${ACTIVE_ONLY ? 'YES' : 'NO'}`);
  console.log(`   • Limit: ${LIMIT || 'ALL'}`);
  console.log(`   • Batch Size: ${BATCH_SIZE} concurrent`);

  try {
    const videos = await findVideosToOptimize();
    
    if (videos.length === 0) {
      console.log('\n✨ No videos found that need optimization!');
      return;
    }
    
    // Calculate total size
    const totalSize = videos.reduce((acc, v) => acc + v.size, 0n);
    
    console.log(`\n📊 Found ${videos.length} videos to process`);
    console.log(`   Total size: ${formatBytes(totalSize)}`);
    
    // Show status breakdown
    const statusCounts: Record<string, number> = {};
    videos.forEach(v => {
      statusCounts[v.optimizationStatus] = (statusCounts[v.optimizationStatus] || 0) + 1;
    });
    console.log(`\n📈 Status breakdown:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   • ${status}: ${count}`);
    });
    
    if (DRY_RUN) {
      console.log('\n🏃 DRY RUN MODE - Showing what would be processed:\n');
    } else {
      console.log('\n🚀 Starting optimization...\n');
    }
    
    let totalSuccess = 0;
    let totalFailed = 0;
    const startTime = Date.now();
    
    // Process in batches
    for (let i = 0; i < videos.length; i += BATCH_SIZE) {
      const { success, failed } = await processBatch(videos, i);
      totalSuccess += success;
      totalFailed += failed;
      
      // Small delay between batches to avoid overwhelming the server
      if (i + BATCH_SIZE < videos.length && !DRY_RUN) {
        console.log(`\n⏳ Waiting 3 seconds before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Total processed: ${videos.length}`);
    console.log(`   ✅ Successful: ${totalSuccess}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log(`   ⏱️  Duration: ${duration}s`);
    
    if (DRY_RUN) {
      console.log('\n💡 This was a dry run. Run without --dry-run to actually optimize.');
    }
    
  } catch (error: any) {
    console.error('\n❌ Script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
main().catch(console.error);