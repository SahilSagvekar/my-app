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
 * Gets the appropriate video source for a video element or iframe
 */
export function getVideoSource(url: string): { type: 'video' | 'iframe', src: string } {
  const info = analyzeVideoUrl(url);
  
  if (info.requiresIframe && info.embedUrl) {
    return { type: 'iframe', src: info.embedUrl };
  }
  
  return { type: 'video', src: url };
}
