// src/components/review/RevisionMedia.tsx
//
// Read-only display of the media a reviewer attached to a revision comment —
// the Snip / Drawing screenshot (with any hand-drawn markup flattened in),
// voice note, and file attachments. Used by the Editor and Scheduler portals,
// where the comment text was already shown but the media was dropped.

'use client';

import { useState } from 'react';
import { Mic, Paperclip, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export interface RevisionMediaItem {
  screenshotUrl?: string | null;
  voiceUrl?: string | null;
  voiceDurationSec?: number | null;
  attachments?: { url: string; name: string; mimeType?: string; size?: number }[] | null;
}

export function hasRevisionMedia(fb: RevisionMediaItem | null | undefined): boolean {
  return !!fb && !!(fb.screenshotUrl || fb.voiceUrl || (fb.attachments && fb.attachments.length > 0));
}

/** "1:30" / "1:02:03" -> seconds. Returns null for "General", "#2", etc. */
export function parseVideoTimestamp(ts?: string | null): number | null {
  if (!ts) return null;
  const parts = ts.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null;
  return parts.map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

export function RevisionMedia({
  media,
  timestamp,
  authorLine,
  onSeek,
  compact = false,
}: {
  media: RevisionMediaItem;
  /** Video timestamp the screenshot was taken at, e.g. "1:30". */
  timestamp?: string | null;
  /** Shown in the full-size viewer, e.g. "Jane · Client · Oct 3, 2026". */
  authorLine?: string;
  /** Called with the timestamp in seconds when the chip is clicked. */
  onSeek?: (seconds: number) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!hasRevisionMedia(media)) return null;

  const seconds = parseVideoTimestamp(timestamp);
  const canSeek = !!onSeek && seconds !== null;

  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {media.screenshotUrl && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block w-full rounded-lg overflow-hidden border border-gray-200 bg-black/5 cursor-zoom-in"
            title="Click to view full size"
          >
            <img
              src={media.screenshotUrl}
              alt={timestamp ? `Marked-up frame at ${timestamp}` : 'Marked-up frame'}
              className={`w-full h-auto object-contain ${compact ? 'max-h-32' : 'max-h-64'}`}
              loading="lazy"
            />
          </button>
          {timestamp && seconds !== null && (
            <button
              type="button"
              disabled={!canSeek}
              onClick={() => onSeek?.(seconds)}
              className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white ${
                canSeek ? 'hover:bg-black cursor-pointer' : 'cursor-default'
              }`}
              title={canSeek ? `Jump to ${timestamp} in the video` : timestamp}
            >
              <Clock className="h-3 w-3" />
              {timestamp}
            </button>
          )}
        </div>
      )}

      {media.voiceUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
          <Mic className="h-3.5 w-3.5 text-gray-500 shrink-0" />
          <audio controls src={media.voiceUrl} className="h-8 w-full" />
          {!!media.voiceDurationSec && (
            <span className="text-[10px] text-gray-500 font-mono shrink-0">
              {Math.floor(media.voiceDurationSec / 60)}:{(media.voiceDurationSec % 60).toString().padStart(2, '0')}
            </span>
          )}
        </div>
      )}

      {media.attachments && media.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {media.attachments.map((att, idx) =>
            att.mimeType?.startsWith('image/') ? (
              <a
                key={`${att.url}-${idx}`}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                title={att.name}
                className="block h-16 w-16 overflow-hidden rounded border border-gray-200 hover:border-gray-400"
              >
                <img src={att.url} alt={att.name} className="h-full w-full object-cover" loading="lazy" />
              </a>
            ) : (
              <a
                key={`${att.url}-${idx}`}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] text-gray-700 hover:border-gray-400"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[160px] truncate">{att.name}</span>
              </a>
            )
          )}
        </div>
      )}

      {media.screenshotUrl && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[min(95vw,1400px)] p-3">
            <DialogTitle className="text-sm">
              Marked-up frame{timestamp ? ` @ ${timestamp}` : ''}
            </DialogTitle>
            <DialogDescription className="text-xs">{authorLine || 'Reviewer screenshot'}</DialogDescription>
            <img
              src={media.screenshotUrl}
              alt={timestamp ? `Marked-up frame at ${timestamp}` : 'Marked-up frame'}
              className="max-h-[80vh] w-full object-contain rounded"
            />
            <div className="flex items-center justify-between">
              <a
                href={media.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Open original ↗
              </a>
              {canSeek && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onSeek!(seconds!); }}
                  className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                >
                  <Clock className="h-3 w-3" /> Jump to {timestamp} in video
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
