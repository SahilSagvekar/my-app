// src/lib/youtube-link.ts
//
// Editor-supplied YouTube link support. Separate from youtube-mirror.ts
// (which *uploads* a review video to YouTube on our behalf) — this is for
// a video that already lives on YouTube and the editor just pastes the
// link. Both paths converge on the same File.youtubeVideoId column and
// the same review-screen playback (getVideoSource() / YoutubePlayer.tsx),
// so once a video ID is extracted and validated here, it plays exactly
// like a mirrored one.

/**
 * Pulls an 11-character YouTube video ID out of any of the URL shapes
 * people actually paste: watch?v=, youtu.be/, /embed/, /shorts/, /live/,
 * or a bare 11-char ID. Returns null if nothing recognizable is found.
 */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  // Bare video ID (no URL at all) — YouTube IDs are always 11 chars of
  // [A-Za-z0-9_-].
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (!['youtube.com', 'youtube-nocookie.com', 'youtu.be'].includes(host)) return null;

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get('v');
  if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

  // youtube.com/embed/<id>, /shorts/<id>, /live/<id>
  const pathMatch = url.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
  if (pathMatch) return pathMatch[1];

  return null;
}

export class YoutubeLinkInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YoutubeLinkInvalidError';
  }
}

/**
 * Confirms the video is actually embeddable (public or unlisted, embedding
 * not disabled) before we save it — otherwise the failure only surfaces
 * later, silently, inside the review screen's YouTube iframe. Uses
 * YouTube's public oEmbed endpoint, which needs no API key/quota and
 * returns 401 for private videos, 404 for deleted/wrong IDs, and 403 when
 * the uploader disabled embedding — we don't need to tell those apart,
 * any non-200 means "won't play here."
 */
export async function assertYoutubeEmbeddable(videoId: string): Promise<void> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;

  let res: Response;
  try {
    res = await fetch(oembedUrl, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new YoutubeLinkInvalidError('Could not reach YouTube to verify this link. Please try again.');
  }

  if (res.status === 401 || res.status === 403) {
    throw new YoutubeLinkInvalidError('This video is private or has embedding disabled — make it public or unlisted with embedding allowed.');
  }
  if (res.status === 404) {
    throw new YoutubeLinkInvalidError('No YouTube video found at this link.');
  }
  if (!res.ok) {
    throw new YoutubeLinkInvalidError('This YouTube link could not be verified as embeddable.');
  }
}