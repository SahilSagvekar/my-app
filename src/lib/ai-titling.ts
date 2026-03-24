// src/lib/ai-titling.ts

const AI_TITLING_API_URL = process.env.AI_TITLING_API_URL;

export interface GeneratedTitle {
  title: string;
  style: string;
  reasoning: string;
}

export interface TitleGenerationResponse {
  success: boolean;
  transcript_summary?: string;
  generated_titles?: GeneratedTitle[];
  processing_time_seconds?: number;
  error?: string;
}

export interface GenerateTitlesParams {
  transcript: string;
  platform?: 'youtube' | 'instagram' | 'tiktok' | 'twitter' | 'general';
  numTitles?: number;
  includeTrends?: boolean;
}

/**
 * Generate video titles from transcript using the AI Titling API
 */
export async function generateTitlesFromTranscript({
  transcript,
  platform = 'youtube',
  numTitles = 5,
  includeTrends = true,
}: GenerateTitlesParams): Promise<TitleGenerationResponse> {
  
  try {
    console.log(`🤖 AI Titling: Generating ${numTitles} titles for ${platform}`);
    console.log(`   Transcript length: ${transcript.length} characters`);

    // Build form data
    const formData = new URLSearchParams();
    formData.append('transcript', transcript);
    formData.append('platform', platform);
    formData.append('num_titles', numTitles.toString());
    formData.append('include_trends', includeTrends.toString());

    const response = await fetch(`${AI_TITLING_API_URL}/api/v1/generate-from-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI Titling API error:', response.status, errorText);
      return {
        success: false,
        error: `API returned ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    
    // API returns: { titles, transcript_summary, trends_used }
    // Map 'titles' to 'generated_titles' for internal consistency
    console.log(`✅ AI Titling: Generated ${data.titles?.length || 0} titles`);
    
    return {
      success: true,
      transcript_summary: data.transcript_summary,
      generated_titles: data.titles,
    };

  } catch (error: any) {
    console.error('❌ AI Titling error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if the AI Titling API is healthy
 */
export async function checkAiTitlingHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AI_TITLING_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}
