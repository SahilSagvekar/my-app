/**
 * Helper utilities for handling video URLs from various sources
 */

export interface VideoUrlInfo {
  isGoogleDrive: boolean;
  isYouTube: boolean;
  isDirect: boolean;
  embedUrl: string | null;
  originalUrl: string;
  requiresIframe: boolean;
}

/**
 * Analyzes a video URL and returns information about how to display it
 */
export function analyzeVideoUrl(url: string | null | undefined): VideoUrlInfo {
  // Handle null/undefined/empty URLs
  if (!url || url.trim() === '') {
    return {
      isGoogleDrive: false,
      isYouTube: false,
      isDirect: false,
      embedUrl: null,
      originalUrl: url || '',
      requiresIframe: false
    };
  }

  const info: VideoUrlInfo = {
    isGoogleDrive: false,
    isYouTube: false,
    isDirect: false,
    embedUrl: null,
    originalUrl: url,
    requiresIframe: false
  };

  // Check for Google Drive URLs
  const googleDriveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
  if (googleDriveMatch) {
    const fileId = googleDriveMatch[1];
    info.isGoogleDrive = true;
    info.requiresIframe = true;
    info.embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    return info;
  }

  // Check for YouTube URLs
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\/]+)/);
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    info.isYouTube = true;
    info.requiresIframe = true;
    info.embedUrl = `https://www.youtube.com/embed/${videoId}`;
    return info;
  }

  // Direct video file
  info.isDirect = true;
  info.embedUrl = url;
  info.requiresIframe = false;
  return info;
}

/**
 * Extracts Google Drive file ID from various Google Drive URL formats
 */
export function extractGoogleDriveFileId(url: string): string | null {
  const patterns = [
    /drive\.google\.com\/file\/d\/([^\/\?]+)/,
    /drive\.google\.com\/open\?id=([^&]+)/,
    /drive\.google\.com\/uc\?id=([^&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Converts a Google Drive URL to an embeddable preview URL
 */
export function convertToGoogleDrivePreview(url: string): string | null {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) return null;

  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Gets the appropriate video source for a video element or iframe.
 * Priority:
 * 1. youtubeVideoId - Review-mirror uploaded this to YouTube (Unlisted) — use
 *    the real IFrame Player API for adaptive bitrate + proper seek support.
 * 2. reviewDriveUrl - Drive mirror fallback (used when YouTube upload failed
 *    or quota was exhausted — see review-mirror.ts).
 * 3. proxyUrl - If a lower-quality version exists, use it for speed.
 * 4. streamProxy - If it's an S3/R2 file, use the byte-range streaming proxy.
 * 5. original - Fallback to the original URL.
 * 
 * @param file - The file object containing url and optional proxyUrl/id
 */
export function getVideoSource(file: { url: string; id?: string; proxyUrl?: string | null; reviewDriveUrl?: string | null; youtubeVideoId?: string | null }): { type: 'video' | 'iframe' | 'youtube', src: string } {
  const { url, id, proxyUrl, reviewDriveUrl, youtubeVideoId } = file;

  // 0. YouTube mirror — highest priority. Real IFrame Player API, unlike
  // Drive's dumb preview embed (see YoutubePlayer.tsx for why).
  if (youtubeVideoId) {
    return { type: 'youtube', src: youtubeVideoId };
  }

  // 0.5 Google Drive mirror — proxied through server so <video> tag works with full review features
  // /api/files/drive-proxy fetches from Drive server-side, no CORS issues, range requests supported
  if (reviewDriveUrl) {
    const fileId = extractGoogleDriveFileId(reviewDriveUrl) ||
      reviewDriveUrl.match(/\/d\/([^\/\?]+)/)?.[1];
    if (fileId) {
      return { type: 'video', src: `/api/files/drive-proxy?fileId=${fileId}` };
    }
  }

  // 1. Use proxyUrl if available
  if (proxyUrl) {
    return { type: 'video', src: proxyUrl };
  }

  const info = analyzeVideoUrl(url);

  // 2. Iframe (YouTube/Drive)
  if (info.requiresIframe && info.embedUrl) {
    return { type: 'iframe', src: info.embedUrl };
  }

  // 3. Streaming proxy for S3/R2-hosted files (supports HTTP Range requests)
  const isObjectStorage = url && (
    url.includes('amazonaws.com') ||
    url.includes('r2.cloudflarestorage.com') ||
    url.includes('r2.dev')
  );
  if (isObjectStorage && id) {
    return { type: 'video', src: `/api/files/${id}/stream` };
  }

  // 4. Fallback to original URL
  return { type: 'video', src: url };
}