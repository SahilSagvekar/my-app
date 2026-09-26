"use client";

import { useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../ui/sheet';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { cn } from '@/lib/utils';
import { useDailyTargetsProgress } from './useDailyTargetsProgress';
import { DeliverableBlock } from './DeliverableRow';
import {
  DELIVERABLE_COLORS,
  PLATFORM_LABEL,
  formatDateEST,
  formatShortDate,
  formatTimeEST,
  getProgressHexColor,
} from './constants';

interface ClientProgressDrawerProps {
  clientId: string | null;
  /** The date currently selected on the board — seeds the drawer's own date nav on open. */
  initialDate: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientProgressDrawer({ clientId, initialDate, open, onOpenChange }: ClientProgressDrawerProps) {
  const {
    data,
    loading,
    setSelectedDate,
    navigateDate,
    goToToday,
  } = useDailyTargetsProgress({ clientId: clientId ?? undefined, initialDate, enabled: open && !!clientId });

  // Reseed the drawer's date to match the board whenever it's opened for a (possibly new) client.
  useEffect(() => {
    if (open) setSelectedDate(initialDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  // Ignore leftover data from a previously opened client until this one loads.
  const first = data?.clients?.[0] ?? null;
  const client = first && first.clientId === clientId ? first : null;
  const borderColor = client
    ? client.noInventoryCount > 0 || client.status === 'critical'
      ? '#f43f5e'
      : client.status === 'behind'
        ? '#f59e0b'
        : getProgressHexColor(client.progress)
    : '#579BFC';

  const todayLinks = client?.deliverables.flatMap((d) => d.todayLinks.map((l) => ({ ...l, type: d.type }))) ?? [];
  todayLinks.sort((a, b) => a.postedAt.localeCompare(b.postedAt));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:w-[560px] sm:max-w-[560px] overflow-y-auto p-0 border-l-4"
        style={{ borderLeftColor: borderColor }}
      >
        <SheetHeader className="sticky top-0 z-10 p-6 pb-4 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between pr-8">
            <SheetTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <div className="w-2 h-8 rounded-full" style={{ backgroundColor: borderColor }} />
              {client?.clientName ?? 'Loading…'}
            </SheetTitle>
            {client && (
              <div className="px-3 py-1 rounded-lg text-xs font-semibold border bg-card">
                {client.totalCompleted}/{client.totalRequired} today
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 border rounded-lg px-1 py-1 mt-2 w-fit">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs font-medium" onClick={goToToday}>
              <Calendar className="h-3 w-3 mr-1.5" />
              {data ? formatDateEST(data.date) : 'Today'}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="p-6 space-y-5">
          {loading && !data && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          )}

          {data && data.clients.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No trackable deliverables for this client.</p>
          )}

          {client?.deliverables.map((d) => (
            <DeliverableBlock key={d.deliverableId} d={d} />
          ))}

          {client && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Posted on this day
              </p>
              {todayLinks.length === 0 && (
                <p className="text-sm text-muted-foreground italic">No links posted</p>
              )}
              {todayLinks.map((link) => (
                <div key={link.id} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 text-sm">
                  <Badge className={cn(
                    DELIVERABLE_COLORS[link.type]?.bg || 'bg-muted',
                    DELIVERABLE_COLORS[link.type]?.text || 'text-muted-foreground',
                    'text-[10px]'
                  )}>
                    {link.type}
                  </Badge>
                  <span className="text-[11px] font-semibold text-muted-foreground w-6">
                    {PLATFORM_LABEL[link.platform] ?? link.platform}
                  </span>
                  <span className="text-muted-foreground truncate flex-1">{link.title || link.url}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeEST(link.postedAt)} EST
                  </span>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-500 hover:text-indigo-700"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}

          {client?.log && client.log.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Posting log this month
              </p>
              <div className="rounded-lg border divide-y text-sm">
                {[...client.log].reverse().map((day) => (
                  <div key={day.date} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-foreground">{formatShortDate(day.date)}</span>
                    <span className="text-xs text-muted-foreground">
                      {day.types.join(', ')} · {day.pieces} piece{day.pieces === 1 ? '' : 's'} · {day.posts} post
                      {day.posts === 1 ? '' : 's'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
