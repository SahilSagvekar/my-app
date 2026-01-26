// src/lib/assemblyai.ts

import { generateSignedUrl, extractS3KeyFromUrl } from './s3';

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY!;
const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

// Get the base URL for webhooks (your app's public URL)
const getWebhookUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.e8productions.com';
  return `${baseUrl}/api/webhooks/assemblyai`;
};

interface TranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  audio_duration?: number;
  error?: string;
}

interface SubmitTranscriptionParams {
  audioUrl: string;
  webhookUrl?: string;
  webhookAuthHeader?: string;
  languageCode?: string;
}

/**
 * Submit audio/video for transcription
 * AssemblyAI will download the file from the URL and process it
 */
export async function submitTranscription({
  audioUrl,
  webhookUrl,
  webhookAuthHeader,
  languageCode = 'en',
}: SubmitTranscriptionParams): Promise<{ transcriptId: string }> {
  
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }

  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLYAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      webhook_url: webhookUrl || getWebhookUrl(),
      webhook_auth_header_name: webhookAuthHeader ? 'X-Webhook-Secret' : undefined,
      webhook_auth_header_value: webhookAuthHeader,
      language_code: languageCode,
      // Optional features (all free):
      punctuate: true,
      format_text: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ AssemblyAI submit error:', error);
    throw new Error(`AssemblyAI submission failed: ${response.status} - ${error}`);
  }

  const data: TranscriptResponse = await response.json();
  
  console.log(`✅ AssemblyAI: Submitted transcription, ID: ${data.id}`);
  
  return { transcriptId: data.id };
}

/**
 * Get transcription status and result
 */
export async function getTranscription(transcriptId: string): Promise<TranscriptResponse> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }

  const response = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`, {
    headers: {
      'Authorization': ASSEMBLYAI_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AssemblyAI fetch failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Submit a video file from S3 for transcription
 * Generates a presigned URL and sends to AssemblyAI
 */
export async function submitVideoForTranscription(
  s3UrlOrKey: string,
  options?: {
    webhookSecret?: string;
    languageCode?: string;
  }
): Promise<{ transcriptId: string; presignedUrl: string }> {
  
  // Extract S3 key from URL if needed
  let s3Key = s3UrlOrKey;
  if (s3UrlOrKey.startsWith('http')) {
    const extracted = extractS3KeyFromUrl(s3UrlOrKey);
    if (!extracted) {
      throw new Error(`Could not extract S3 key from URL: ${s3UrlOrKey}`);
    }
    s3Key = extracted;
  }

  // Generate presigned URL valid for 6 hours (enough time for AssemblyAI to download large files)
  const presignedUrl = await generateSignedUrl(s3Key, 6 * 60 * 60);
  
  console.log(`📤 AssemblyAI: Submitting video for transcription`);
  console.log(`   S3 Key: ${s3Key}`);
  
  const { transcriptId } = await submitTranscription({
    audioUrl: presignedUrl,
    webhookAuthHeader: options?.webhookSecret,
    languageCode: options?.languageCode,
  });

  return { transcriptId, presignedUrl };
}

/**
 * Poll for transcription completion (fallback if webhook fails)
 * Use sparingly - webhook is preferred
 */
export async function waitForTranscription(
  transcriptId: string,
  maxWaitMs: number = 30 * 60 * 1000, // 30 minutes default
  pollIntervalMs: number = 10000 // 10 seconds
): Promise<TranscriptResponse> {
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const result = await getTranscription(transcriptId);
    
    if (result.status === 'completed') {
      return result;
    }
    
    if (result.status === 'error') {
      throw new Error(`Transcription failed: ${result.error}`);
    }
    
    // Still processing, wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  throw new Error(`Transcription timed out after ${maxWaitMs / 1000} seconds`);
}

/**
 * Verify webhook signature (if using webhook secret)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // AssemblyAI uses the secret as a simple header value comparison
  // They send: X-Webhook-Secret: <your-secret>
  return signature === secret;
}
