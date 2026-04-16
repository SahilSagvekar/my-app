// Run: npx tsx scripts/check-file-urls.ts
// This checks if s3Key, url, and proxyUrl are correctly set

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking recent video files...\n');

  const files = await prisma.file.findMany({
    where: {
      mimeType: { startsWith: 'video/' },
    },
    select: {
      id: true,
      name: true,
      url: true,
      s3Key: true,
      proxyUrl: true,
      optimizationStatus: true,
      size: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`Found ${files.length} recent video files:\n`);

  for (const file of files) {
    console.log('─'.repeat(80));
    console.log(`📁 ${file.name}`);
    console.log(`   ID: ${file.id}`);
    console.log(`   Size: ${file.size ? (Number(file.size) / 1024 / 1024).toFixed(2) + ' MB' : 'unknown'}`);
    console.log(`   Created: ${file.createdAt}`);
    console.log(`   Optimization: ${file.optimizationStatus}`);
    console.log('');
    console.log(`   url:      ${file.url}`);
    console.log(`   s3Key:    ${file.s3Key}`);
    console.log(`   proxyUrl: ${file.proxyUrl}`);
    
    // Check for issues
    const issues: string[] = [];
    
    if (!file.s3Key) {
      issues.push('❌ MISSING s3Key - downloads will fail!');
    }
    
    if (file.s3Key && file.s3Key.includes('optimized')) {
      issues.push('⚠️  s3Key contains "optimized" - original may be lost!');
    }
    
    if (file.url && file.url.includes('optimized')) {
      issues.push('⚠️  url contains "optimized" - check if original exists');
    }
    
    if (file.s3Key && file.url) {
      const keyFromUrl = file.url.split('/').slice(-2).join('/');
      if (!file.url.includes(file.s3Key) && !file.s3Key.includes(keyFromUrl)) {
        issues.push('⚠️  url and s3Key paths differ - may cause issues');
      }
    }

    if (issues.length > 0) {
      console.log('');
      issues.forEach(issue => console.log(`   ${issue}`));
    } else {
      console.log('   ✅ Looks good');
    }
    console.log('');
  }

  // Summary
  console.log('─'.repeat(80));
  console.log('\n📊 Summary:');
  
  const withoutS3Key = files.filter(f => !f.s3Key).length;
  const withOptimizedS3Key = files.filter(f => f.s3Key?.includes('optimized')).length;
  const optimized = files.filter(f => f.optimizationStatus === 'COMPLETED').length;
  
  console.log(`   Total checked: ${files.length}`);
  console.log(`   Missing s3Key: ${withoutS3Key}`);
  console.log(`   s3Key contains "optimized": ${withOptimizedS3Key}`);
  console.log(`   Optimization completed: ${optimized}`);
  
  if (withOptimizedS3Key > 0) {
    console.log('\n⚠️  WARNING: Some files have "optimized" in s3Key.');
    console.log('   This means downloads will get the compressed version, not the original!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());