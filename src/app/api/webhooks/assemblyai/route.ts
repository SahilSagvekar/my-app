// src/app/api/webhooks/assemblyai/route.ts

import { NextResponse } from 'next/server';
import { completeTitlingJob, failTitlingJob } from '@/lib/titling-service';

const WEBHOOK_SECRET = process.env.ASSEMBLYAI_WEBHOOK_SECRET || 'e8-titling-secret';

/**
 * AssemblyAI Webhook Handler
 * 
 * AssemblyAI calls this endpoint when transcription is complete
 * 
 * Payload structure:
 * {
 *   "transcript_id": "abc123",
 *   "status": "completed" | "error",
 *   "text": "The transcribed text...",
 *   "audio_duration": 3600,
 *   "error": "Error message if failed"
 * }
 */
export async function POST(req: Request) {
  try {
    console.log('\n📩 AssemblyAI Webhook received');

    // 1. Verify webhook secret (if configured)
    const webhookSecret = req.headers.get('x-webhook-secret');
    if (WEBHOOK_SECRET && webhookSecret !== WEBHOOK_SECRET) {
      console.error('   ❌ Invalid webhook secret');
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    // 2. Parse payload
    const payload = await req.json();
    
    const {
      transcript_id,
      status,
      text,
      audio_duration,
      error,
    } = payload;

    console.log(`   Transcript ID: ${transcript_id}`);
    console.log(`   Status: ${status}`);
    console.log(`   Audio Duration: ${audio_duration ? `${Math.round(audio_duration / 60)} minutes` : 'N/A'}`);

    if (!transcript_id) {
      console.error('   ❌ Missing transcript_id');
      return NextResponse.json({ error: 'Missing transcript_id' }, { status: 400 });
    }

    // 3. Handle based on status
    if (status === 'completed' && text) {
      console.log(`   ✅ Transcription completed, length: ${text.length} chars`);
      
      const result = await completeTitlingJob(transcript_id, text, audio_duration);
      
      if (result.success) {
        console.log(`   🎉 Titles generated successfully for task: ${result.taskId}`);
        return NextResponse.json({
          success: true,
          taskId: result.taskId,
          titlesGenerated: result.titles?.length || 0,
        });
      } else {
        console.error(`   ❌ Failed to generate titles: ${result.error}`);
        return NextResponse.json({
          success: false,
          error: result.error,
        }, { status: 500 });
      }

    } else if (status === 'error') {
      console.error(`   ❌ Transcription failed: ${error}`);
      
      await failTitlingJob(transcript_id, error || 'Unknown transcription error');
      
      return NextResponse.json({
        success: false,
        error: error || 'Transcription failed',
      });

    } else {
      console.log(`   ℹ️ Received status: ${status} (not actionable)`);
      return NextResponse.json({ success: true, message: `Status ${status} acknowledged` });
    }

  } catch (err: any) {
    console.error('❌ Webhook error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Also handle GET for webhook verification (some services ping this)
export async function GET(req: Request) {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'AssemblyAI Webhook',
    timestamp: new Date().toISOString(),
  });
}
