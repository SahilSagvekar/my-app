// Normalize deliverableType from PostedContent to short code
// PostedContent might store "Short Form Videos" or "SF" — we need consistent matching
export function normalizeDeliverableType(type: string | null | undefined): string {
  if (!type) return '';
  const t = type.toLowerCase().trim();
  if (t === 'short form videos' || t === 'sf') return 'SF';
  if (t === 'long form videos' || t === 'lf') return 'LF';
  if (t === 'square form videos' || t === 'sqf') return 'SQF';
  if (t === 'thumbnails' || t === 'thumb') return 'THUMB';
  if (t === 'tiles' || t === 't') return 'T';
  if (t === 'hard posts / graphic images' || t === 'hard posts' || t === 'hp') return 'HP';
  if (t === 'snapchat episodes' || t === 'sep') return 'SEP';
  if (t === 'beta short form' || t === 'bsf') return 'BSF';
  if (t === 'stories' || t === 'st') return 'ST';
  if (t === 'text post' || t === 'tp') return 'TP';
  return type.toUpperCase().replace(/\s+/g, '');
}

// Map PostedContent platform (lowercase) to all PostingTarget platform names it could match
export function normalizePlatformForMatch(postedPlatform: string): string[] {
  const p = postedPlatform.toLowerCase().trim();
  const map: Record<string, string[]> = {
    'instagram': ['IG', 'IG (Trials)', 'Instagram', 'ig', 'ig (trials)', 'instagram'],
    'facebook': ['FB Profile', 'FB Page', 'FB TV', 'Facebook', 'fb profile', 'fb page', 'fb tv', 'facebook'],
    'tiktok': ['TT', 'TikTok', 'tt', 'tiktok'],
    'youtube': ['YT', 'YouTube', 'yt', 'youtube'],
    'linkedin': ['LI', 'LinkedIn', 'li', 'linkedin'],
    'twitter': ['Twitter', 'X', 'twitter', 'x'],
    'snapchat': ['Snapchat', 'snapchat'],
  };
  return map[p] || [postedPlatform];
}

// Map PostingTarget platform to PostedContent platform (reverse)
export function targetPlatformToPostedPlatform(targetPlatform: string): string {
  const p = targetPlatform.toLowerCase();
  if (p.includes('ig') || p.includes('instagram')) return 'instagram';
  if (p.includes('fb') || p.includes('facebook')) return 'facebook';
  if (p === 'tt' || p.includes('tiktok')) return 'tiktok';
  if (p === 'yt' || p.includes('youtube')) return 'youtube';
  if (p === 'li' || p.includes('linkedin')) return 'linkedin';
  if (p.includes('twitter') || p === 'x') return 'twitter';
  if (p.includes('snapchat')) return 'snapchat';
  return p;
}
