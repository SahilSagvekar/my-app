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
 * 0. reviewDriveUrl — Drive mirror for lag-free client review playback
 * 1. proxyUrl — lower-quality compressed version for speed
 * 2. streamProxy — S3/R2 byte-range streaming proxy
 * 3. original — fallback
 */
export function getVideoSource(file: {
  url: string;
  id?: string;
  proxyUrl?: string | null;
  reviewDriveUrl?: string | null;
}): { type: 'video' | 'iframe'; src: string } {
  const { url, id, proxyUrl, reviewDriveUrl } = file;

  // 0. Drive mirror — lag-free streaming for client review
  if (reviewDriveUrl) {
    const fileId = extractGoogleDriveFileId(reviewDriveUrl);
    if (fileId) {
      return { type: 'iframe', src: `https://drive.google.com/file/d/${fileId}/preview` };
    }
  }

  // 1. proxyUrl (compressed version)
  if (proxyUrl) {
    return { type: 'video', src: proxyUrl };
  }

  const info = analyzeVideoUrl(url);

  // 2. Iframe (YouTube/Drive direct URL)
  if (info.requiresIframe && info.embedUrl) {
    return { type: 'iframe', src: info.embedUrl };
  }

  // 3. Streaming proxy for S3/R2-hosted files
  const isObjectStorage = url && (
    url.includes('amazonaws.com') ||
    url.includes('r2.cloudflarestorage.com') ||
    url.includes('r2.dev')
  );
  if (isObjectStorage && id) {
    return { type: 'video', src: `/api/files/${id}/stream` };
  }

  // 4. Fallback
  return { type: 'video', src: url };
}