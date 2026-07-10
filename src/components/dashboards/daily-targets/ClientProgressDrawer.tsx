"use client";

import { useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../ui/sheet';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { cn } from '@/lib/utils';
import { useDailyTargetsProgress } from './useDailyTargetsProgress';
import {
  DELIVERABLE_COLORS,
  formatDateEST,
  formatTimeEST,
  getPlatformConfig,
  getProgressColor,
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
  } = useDailyTargetsProgress({ clientId: clientId ?? undefined, initialDate });

  // Reseed the drawer's date to match the board whenever it's opened for a (possibly new) client.
  useEffect(() => {
    if (open) setSelectedDate(initialDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientId]);

  const client = data?.clients?.[0] ?? null;
  const borderColor = client ? getProgressHexColor(client.progress) : '#579BFC';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:w-[560px] sm:max-w-[560px] overflow-y-auto p-0 border-l-4"
        style={{ borderLeftColor: borderColor }}
      >
        <SheetHeader className="sticky top-0 z-10 p-6 pb-4 border-b bg-gray-50/95 backdrop-blur">
          <div className="flex items-center justify-between pr-8">
            <SheetTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <div className="w-2 h-8 rounded-full" style={{ backgroundColor: borderColor }} />
              {client?.clientName ?? 'Loading…'}
            </SheetTitle>
            {client && (
              <div className={cn(
                "px-3 py-1 rounded-lg text-white font-bold text-sm",
                `bg-gradient-to-r ${getProgressColor(client.progress)}`
              )}>
                {client.totalCompleted}/{client.totalRequired}
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

          {data && !client && (
            <p className="text-sm text-muted-foreground italic">No active posting targets for this client on this date.</p>
          )}

          {client?.platforms.map((platform) => {
            const pConfig = getPlatformConfig(platform.platform);
            const Icon = pConfig.icon;

            return (
              <div key={platform.platform} className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
                    pConfig.bgColor, pConfig.color
                  )}>
                    {Icon && <Icon className="h-4 w-4" />}
                    {platform.platform}
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    {platform.totalCompleted}/{platform.totalRequired}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {platform.deliverables.map((d) => {
                    const dColor = DELIVERABLE_COLORS[d.deliverableType] || { bg: 'bg-gray-100', text: 'text-gray-700' };
                    const freqLabel = d.frequency === 'daily' ? '' : `/${d.frequency}`;
                    if (d.monthlyAccomplished) {
                      return (
                        <div key={d.deliverableType} className="inline-flex items-center gap-1">
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            🎉 {d.deliverableType} monthly target accomplished ({d.monthlyCompleted}/{d.monthlyRequired})
                          </Badge>
                        </div>
                      );
                    }
                    return (
                      <div key={d.deliverableType} className="inline-flex items-center gap-1">
                        <Badge className={cn(dColor.bg, dColor.text, `hover:${dColor.bg}`, !d.isActive && 'opacity-40')}>
                          {d.completed}/{d.required} {d.deliverableType}{freqLabel}
                          {d.remaining > 0 && ` · ${d.remaining} left`}
                        </Badge>
                        {d.monthlyRequired != null && (
                          <span className="text-[10px] text-muted-foreground">
                            ({d.monthlyCompleted}/{d.monthlyRequired} this month)
                          </span>
                        )}
                        {d.extras?.tiles && (
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-[10px]">+Tiles</Badge>
                        )}
                        {d.extras?.thumb && (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">+Thumb</Badge>
                        )}
                        {!d.isActive && <span className="text-[11px] text-amber-500">not active today</span>}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Posted Links
                  </p>
                  {platform.deliverables.every(d => d.links.length === 0) && (
                    <p className="text-sm text-muted-foreground italic">No links posted yet</p>
                  )}
                  {platform.deliverables.map(d =>
                    d.links.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-gray-50 text-sm"
                      >
                        <Badge className={cn(
                          DELIVERABLE_COLORS[d.deliverableType]?.bg || 'bg-gray-100',
                          DELIVERABLE_COLORS[d.deliverableType]?.text || 'text-gray-700',
                          'text-[10px]'
                        )}>
                          {d.deliverableType}
                        </Badge>
                        <span className="text-gray-600 truncate flex-1">
                          {link.title || link.url}
                        </span>
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
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
