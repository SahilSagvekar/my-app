'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Megaphone, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

interface FeedItem {
  id: string;
  title: string;
  body: string;
  type: string;
  linkUrl: string | null;
  linkLabel: string | null;
  showPopup: boolean;
  publishedAt: string | null;
  read: boolean;
  dismissed: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  NEW_FEATURE: 'New feature',
  UPDATE: 'Update',
  MAINTENANCE: 'Maintenance',
  IMPORTANT: 'Important',
};
const TYPE_STYLE: Record<string, string> = {
  NEW_FEATURE: 'bg-emerald-50 text-emerald-700',
  UPDATE: 'bg-blue-50 text-blue-700',
  MAINTENANCE: 'bg-amber-50 text-amber-700',
  IMPORTANT: 'bg-red-50 text-red-700',
};

function timeAgo(iso: string | null) {
  if (!iso) return '';
  // DB timestamps are UTC without a zone suffix.
  const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

const POLL_MS = 120_000;

/** Header bell for announcements ("What's new") + one-time popup for important ones. */
export function AnnouncementsBell() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [popupQueue, setPopupQueue] = useState<FeedItem[]>([]);
  const [open, setOpen] = useState(false);
  const shownPopupIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      const fresh = (Array.isArray(data.popup) ? data.popup : []).filter(
        (p: FeedItem) => !shownPopupIds.current.has(p.id),
      );
      if (fresh.length) {
        fresh.forEach((p: FeedItem) => shownPopupIds.current.add(p.id));
        setPopupQueue((q) => [...q, ...fresh]);
      }
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((i) => !i.read).length;

  const post = (body: object) =>
    fetch('/api/announcements/read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});

  const markAllRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await post({ all: true });
  };

  const markOneRead = async (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    await post({ ids: [id] });
  };

  const dismissPopup = async () => {
    const current = popupQueue[0];
    if (!current) return;
    setPopupQueue((q) => q.slice(1));
    setItems((prev) => prev.map((i) => (i.id === current.id ? { ...i, read: true, dismissed: true } : i)));
    await post({ ids: [current.id], dismiss: true });
  };

  const current = popupQueue[0];

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="relative min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" aria-label="What's new">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] max-w-[92vw] p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Megaphone className="h-4 w-4" /> What&apos;s new
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing new yet.</div>
            ) : (
              items.map((i) => (
                <div
                  key={i.id}
                  onClick={() => !i.read && markOneRead(i.id)}
                  className={`px-4 py-3 border-b last:border-b-0 cursor-default ${i.read ? '' : 'bg-blue-50/40'}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${TYPE_STYLE[i.type] || TYPE_STYLE.UPDATE}`}>
                      {TYPE_LABEL[i.type] || 'Update'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{timeAgo(i.publishedAt)}</span>
                    {!i.read && <span className="ml-auto h-2 w-2 rounded-full bg-blue-500" />}
                  </div>
                  <div className="text-sm font-semibold leading-snug">{i.title}</div>
                  <div className="text-[13px] text-gray-600 whitespace-pre-line mt-0.5">{i.body}</div>
                  {i.linkUrl && (
                    <a
                      href={i.linkUrl}
                      target={/^https?:/i.test(i.linkUrl) ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      onClick={() => markOneRead(i.id)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1.5"
                    >
                      {i.linkLabel || 'Learn more'} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* One-time popup for announcements flagged "important" */}
      <Dialog open={!!current} onOpenChange={(o) => !o && dismissPopup()}>
        <DialogContent className="sm:max-w-[460px]">
          {current && (
            <>
              <DialogHeader>
                <div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${TYPE_STYLE[current.type] || TYPE_STYLE.UPDATE}`}>
                    {TYPE_LABEL[current.type] || 'Update'}
                  </span>
                </div>
                <DialogTitle>{current.title}</DialogTitle>
                <DialogDescription className="whitespace-pre-line text-left text-gray-600">{current.body}</DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                {current.linkUrl && (
                  <Button asChild variant="outline" onClick={dismissPopup}>
                    <a href={current.linkUrl} target={/^https?:/i.test(current.linkUrl) ? '_blank' : undefined} rel="noopener noreferrer">
                      {current.linkLabel || 'Learn more'}
                    </a>
                  </Button>
                )}
                <Button onClick={dismissPopup}>Got it</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
