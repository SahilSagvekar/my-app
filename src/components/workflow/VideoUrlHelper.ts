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
 * True when `url` is an S3/R2 presigned GET URL that is still valid for at
 * least `marginSeconds` more seconds. Reads X-Amz-Date + X-Amz-Expires from
 * the query string, so it needs no server round trip.
 */
export function isFreshPresignedUrl(url: string | null | undefined, marginSeconds = 300): boolean {
  if (!url) return false;
  try {
    const params = new URL(url).searchParams;
    if (!params.get('X-Amz-Signature')) return false;
    const date = params.get('X-Amz-Date'); // e.g. 20260930T075500Z
    const expires = Number(params.get('X-Amz-Expires'));
    const m = date?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!m || !Number.isFinite(expires) || expires <= 0) return false;
    const signedAt = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return Date.now() < signedAt + (expires - marginSeconds) * 1000;
  } catch {
    return false;
  }
}

const preconnected = new Set<string>();

/**
 * Opens (and keeps warm) the connection to the host a URL lives on, so the
 * first request to it skips DNS + TCP + TLS. Safe to call repeatedly — each
 * origin is only hinted once. No-op on the server and for same-origin URLs.
 */
export function preconnectToUrlOrigin(url: string | null | undefined): void {
  if (typeof document === 'undefined' || !url) return;
  try {
    const origin = new URL(url, window.location.href).origin;
    if (origin === window.location.origin || preconnected.has(origin)) return;
    preconnected.add(origin);
    // Video elements that set crossOrigin="anonymous" and ones that don't use
    // different connection pools, so hint both.
    for (const crossOrigin of [true, false]) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin;
      if (crossOrigin) link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  } catch {
    /* invalid URL — nothing to warm */
  }
}

/**
 * Gets the appropriate video source for a video element or iframe.
 * Priority:
 * 1. youtubeVideoId - Review-mirror uploaded this to YouTube (Unlisted) — use
 *    the real IFrame Player API for adaptive bitrate + proper seek support.
 * 2. reviewDriveUrl - Drive mirror fallback (used when YouTube upload failed
 *    or quota was exhausted — see review-mirror.ts).
 * 3. proxyUrl - If a lower-quality version exists, use it for speed.
 * 4. The already-signed storage URL itself, when `preferDirect` is set and it
 *    is still valid — skips the extra /api/files/:id/stream hop (auth + DB
 *    lookup + re-sign + 302) before the first byte.
 * 5. streamProxy - If it's an S3/R2 file, use the byte-range streaming proxy.
 * 6. original - Fallback to the original URL.
 *
 * @param file - The file object containing url and optional proxyUrl/id.
 *   `preferDirect` must be false whenever the caller appends its own query
 *   params (e.g. a `_r=` retry cache-buster): a presigned URL is signed over
 *   its exact query string, so any extra param invalidates it. On retry, pass
 *   false to get the /stream route, which signs a fresh URL every time.
 */
export function getVideoSource(file: { url: string; id?: string; proxyUrl?: string | null; reviewDriveUrl?: string | null; youtubeVideoId?: string | null; preferDirect?: boolean }): { type: 'video' | 'iframe' | 'youtube', src: string } {
  const { url, id, proxyUrl, reviewDriveUrl, youtubeVideoId, preferDirect } = file;

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
    // Fast path: the list response already carries a freshly presigned URL.
    // Playing it directly saves a full Worker round trip (auth + DB + sign +
    // redirect) before the browser can request the first byte.
    if (preferDirect && isFreshPresignedUrl(url)) {
      return { type: 'video', src: url };
    }
    return { type: 'video', src: `/api/files/${id}/stream` };
  }

  // 4. Fallback to original URL
  return { type: 'video', src: url };
}