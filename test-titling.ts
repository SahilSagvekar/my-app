/**
 * E8 AI Titling - Standalone Test Script
 * 
 * Tests the full flow:
 * 1. Generate S3 presigned URL
 * 2. Send to AssemblyAI for transcription
 * 3. Wait for transcript (polling)
 * 4. Send transcript to AI Titling API
 * 5. Display generated titles
 * 
 * Usage:
 *   npx ts-node test-titling.ts "ClientName/outputs/video.mp4"
 */

import 'dotenv/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // AWS (from your .env)
  aws: {
    region: process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    bucket: process.env.AWS_S3_BUCKET,
  },
  // AssemblyAI
  assemblyai: {
    apiKey: process.env.ASSEMBLYAI_API_KEY!,
    baseUrl: 'https://api.assemblyai.com/v2',
  },
  // Your AI Titling API
  aiTitling: {
    url: process.env.AI_TITLING_API_URL!,
  },
};

// ============================================
// ASSEMBLYAI FUNCTIONS
// ============================================

async function submitToAssemblyAI(audioUrl: string): Promise<string> {
  console.log('📤 Submitting to AssemblyAI...');
  
  const response = await fetch(`${CONFIG.assemblyai.baseUrl}/transcript`, {
    method: 'POST',
    headers: {
      'Authorization': CONFIG.assemblyai.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: 'en',
      punctuate: true,
      format_text: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AssemblyAI submit failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log(`✅ Submitted! Transcript ID: ${data.id}`);
  return data.id;
}

async function getTranscriptStatus(transcriptId: string): Promise<{
  status: string;
  text?: string;
  error?: string;
  audio_duration?: number;
}> {
  const response = await fetch(`${CONFIG.assemblyai.baseUrl}/transcript/${transcriptId}`, {
    headers: {
      'Authorization': CONFIG.assemblyai.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get transcript: ${response.status}`);
  }

  return response.json();
}

async function waitForTranscript(transcriptId: string): Promise<{
  text: string;
  duration: number;
}> {
  console.log('\n⏳ Waiting for transcription...');
  console.log('   (This may take a few minutes for long videos)\n');

  const startTime = Date.now();
  const maxWaitMs = 60 * 60 * 1000; // 1 hour max
  const pollIntervalMs = 10000; // 10 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const result = await getTranscriptStatus(transcriptId);
    
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r   Status: ${result.status} (${elapsed}s elapsed)      `);

    if (result.status === 'completed' && result.text) {
      console.log('\n\n✅ Transcription complete!');
      return {
        text: result.text,
        duration: result.audio_duration || 0,
      };
    }

    if (result.status === 'error') {
      throw new Error(`Transcription failed: ${result.error}`);
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Transcription timed out after 1 hour');
}

// ============================================
// AI TITLING API FUNCTIONS
// ============================================

async function generateTitles(transcript: string, platform: string = 'youtube'): Promise<{
  summary?: string;
  titles?: Array<{ title: string; style: string; reasoning: string }>;
}> {
  console.log('\n🤖 Generating titles with AI API...');

  const formData = new URLSearchParams();
  formData.append('transcript', transcript);
  formData.append('platform', platform);
  formData.append('num_titles', '5');
  formData.append('include_trends', 'true');

  const response = await fetch(`${CONFIG.aiTitling.url}/api/v1/generate-from-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI Titling API failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    summary: data.transcript_summary,
    titles: data.titles,
  };
}

// ============================================
// S3 FUNCTIONS
// ============================================

async function generatePresignedUrl(s3Key: string): Promise<string> {
  const s3Client = new S3Client({
    region: CONFIG.aws.region,
    credentials: {
      accessKeyId: CONFIG.aws.accessKeyId,
      secretAccessKey: CONFIG.aws.secretAccessKey,
    },
  });

  const command = new GetObjectCommand({
    Bucket: CONFIG.aws.bucket,
    Key: s3Key,
  });

  // 6 hours validity (enough for large files)
  const url = await getSignedUrl(s3Client, command, { expiresIn: 6 * 60 * 60 });
  return url;
}

function extractS3Key(input: string): string {
  if (input.startsWith('http')) {
    try {
      const url = new URL(input);
      return decodeURIComponent(url.pathname.slice(1));
    } catch {
      throw new Error(`Invalid URL: ${input}`);
    }
  }
  return input;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const input = process.argv[2];
  const platform = process.argv[3] || 'youtube';

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         E8 AI TITLING - STANDALONE TEST                      ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Validate input
  if (!input) {
    console.log(`Usage:
  npx ts-node test-titling.ts <s3-key-or-url> [platform]

Examples:
  npx ts-node test-titling.ts "ClientName/outputs/video.mp4"
  npx ts-node test-titling.ts "ClientName/outputs/video.mp4" instagram

Platforms: youtube, instagram, tiktok, twitter, general
`);
    process.exit(1);
  }

  // Validate config
  const missingConfig: string[] = [];
  if (!CONFIG.aws.accessKeyId) missingConfig.push('AWS_ACCESS_KEY_ID');
  if (!CONFIG.aws.secretAccessKey) missingConfig.push('AWS_SECRET_ACCESS_KEY');
  if (!CONFIG.assemblyai.apiKey) missingConfig.push('ASSEMBLYAI_API_KEY');

  if (missingConfig.length > 0) {
    console.error('❌ Missing environment variables:');
    missingConfig.forEach(v => console.error(`   - ${v}`));
    console.error('\nCreate a .env file with these variables or export them.');
    process.exit(1);
  }

  const s3Key = extractS3Key(input);

  console.log(`📁 S3 Bucket:  ${CONFIG.aws.bucket}`);
  console.log(`📁 S3 Key:     ${s3Key}`);
  console.log(`🎯 Platform:   ${platform}`);
  console.log(`🌐 AI API:     ${CONFIG.aiTitling.url}`);

  try {
    // Step 1: Generate presigned URL
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Generating S3 presigned URL...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const presignedUrl = await generatePresignedUrl(s3Key);
    console.log('✅ Presigned URL generated (valid for 6 hours)');

    // Step 2: Submit to AssemblyAI
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Submitting to AssemblyAI...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const transcriptId = await submitToAssemblyAI(presignedUrl);

    // Step 3: Wait for transcription
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: Waiting for transcription...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const { text: transcript, duration } = await waitForTranscript(transcriptId);
    
    console.log(`\n📝 TRANSCRIPT INFO:`);
    console.log(`   Duration:   ${Math.round(duration / 60)} minutes`);
    console.log(`   Length:     ${transcript.length} characters`);
    console.log(`   Word count: ~${transcript.split(/\s+/).length} words`);
    console.log(`\n   Preview (first 500 chars):`);
    console.log(`   "${transcript.slice(0, 500)}..."`);

    // Step 4: Generate titles
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: Generating titles with AI API...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { summary, titles } = await generateTitles(transcript, platform);

    // Display results
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (summary) {
      console.log('\n📊 SUMMARY:');
      console.log(`   ${summary}`);
    }

    console.log('\n🎯 GENERATED TITLES:\n');
    
    if (titles && titles.length > 0) {
      titles.forEach((title, i) => {
        console.log(`   ${i + 1}. [${title.style?.toUpperCase() || 'GENERAL'}]`);
        console.log(`      "${title.title}"`);
        if (title.reasoning) {
          console.log(`      💡 ${title.reasoning}`);
        }
        console.log('');
      });
    } else {
      console.log('   No titles generated');
    }

    // Save full results to file
    const resultFile = `titling-result-${Date.now()}.json`;
    const fs = await import('fs');
    fs.writeFileSync(resultFile, JSON.stringify({
      s3Key,
      platform,
      transcriptId,
      duration,
      transcript,
      summary,
      titles,
      timestamp: new Date().toISOString(),
    }, null, 2));
    
    console.log(`\n💾 Full results saved to: ${resultFile}`);
    console.log('\n✅ Test completed successfully!\n');

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    
    if (error.message.includes('NoSuchKey')) {
      console.error('\n   The S3 key does not exist. Check your bucket and key.');
    } else if (error.message.includes('AccessDenied')) {
      console.error('\n   Access denied. Check your AWS credentials.');
    } else if (error.message.includes('AssemblyAI')) {
      console.error('\n   AssemblyAI error. Check your API key.');
    }
    
    process.exit(1);
  }
}

main();
