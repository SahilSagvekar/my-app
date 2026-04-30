"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Target,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  ChevronLeft,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

// ─── Platform Icons ───
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><circle cx="12" cy="12" r="5" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.81 3.02 3.02 0 0 0 2.12 2.14c1.84.55 9.38.55 9.38.55s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.81zM9.54 15.57V8.43L15.82 12l-6.28 3.57z" />
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" />
  </svg>
);

const SnapchatIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.2 2c3.34 0 5.18 2.38 5.48 5.46.08.78.04 1.59-.01 2.37-.03.49.28.67.72.8.31.1.64.16.95.27.4.14.56.42.42.78-.14.37-.47.45-.84.4-.37-.05-.73-.15-1.1-.16-.5-.01-.9.2-1.23.56-.57.62-1.22 1.15-2.03 1.47-.48.19-.97.18-1.45-.02-.78-.32-1.42-.84-1.97-1.45-.33-.37-.73-.58-1.23-.57-.38.01-.74.11-1.11.16-.36.05-.69-.03-.83-.4-.14-.36.02-.64.42-.78.31-.11.64-.17.95-.27.44-.13.75-.31.72-.8-.05-.78-.09-1.59-.01-2.37C10.02 4.38 11.86 2 15.2 2h-3z" />
  </svg>
);

const PLATFORM_CONFIG: Record<string, { icon: any; color: string; bgColor: string }> = {
  'ig': { icon: InstagramIcon, color: 'text-pink-600', bgColor: 'bg-pink-50' },
  'ig (trials)': { icon: InstagramIcon, color: 'text-pink-600', bgColor: 'bg-pink-50' },
  'instagram': { icon: InstagramIcon, color: 'text-pink-600', bgColor: 'bg-pink-50' },
  'yt': { icon: YoutubeIcon, color: 'text-red-600', bgColor: 'bg-red-50' },
  'youtube': { icon: YoutubeIcon, color: 'text-red-600', bgColor: 'bg-red-50' },
  'tt': { icon: TikTokIcon, color: 'text-black', bgColor: 'bg-gray-100' },
  'tiktok': { icon: TikTokIcon, color: 'text-black', bgColor: 'bg-gray-100' },
  'fb profile': { icon: FacebookIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'fb page': { icon: FacebookIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'fb tv': { icon: FacebookIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'facebook': { icon: FacebookIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  'li': { icon: LinkedinIcon, color: 'text-blue-700', bgColor: 'bg-blue-50' },
  'linkedin': { icon: LinkedinIcon, color: 'text-blue-700', bgColor: 'bg-blue-50' },
  'snapchat': { icon: SnapchatIcon, color: 'text-yellow-500', bgColor: 'bg-yellow-50' },
};

const DELIVERABLE_COLORS: Record<string, { bg: string; text: string }> = {
  'SF': { bg: 'bg-violet-100', text: 'text-violet-700' },
  'BSF': { bg: 'bg-slate-100', text: 'text-slate-700' },
  'SQF': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'HP': { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  'LF': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'SEP': { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

// ─── Types ───
interface PostLink {
  id: string;
  url: string;
  title: string | null;
  postedAt: string;
  taskId: string | null;
}

interface DeliverableProgress {
  deliverableType: string;
  required: number;
  frequency: string;
  isActive: boolean;
  completed: number;
  remaining: number;
  extras: { tiles?: boolean; thumb?: boolean; note?: string } | null;
  links: PostLink[];
}

interface PlatformProgress {
  platform: string;
  deliverables: DeliverableProgress[];
  totalRequired: number;
  totalCompleted: number;
  progress: number;
}

interface ClientProgress {
  clientId: string;
  clientName: string;
  platforms: PlatformProgress[];
  totalRequired: number;
  totalCompleted: number;
  progress: number;
}

interface ProgressResponse {
  ok: boolean;
  date: string;
  dayOfWeek: number;
  isSunday: boolean;
  grandTotal: number;
  grandCompleted: number;
  grandProgress: number;
  clients: ClientProgress[];
}

// ─── Helpers ───
const getPlatformConfig = (platformName: string) => {
  const key = platformName.toLowerCase();
  return PLATFORM_CONFIG[key] || PLATFORM_CONFIG[key.split(' ')[0]] || { icon: null, color: 'text-gray-600', bgColor: 'bg-gray-100' };
};

function formatDateEST(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getProgressColor(progress: number): string {
  if (progress >= 100) return 'from-emerald-400 to-teal-500';
  if (progress >= 50) return 'from-amber-400 to-orange-500';
  return 'from-rose-400 to-pink-500';
}

function getProgressIcon(progress: number) {
  if (progress >= 100) return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (progress >= 50) return <Clock className="h-4 w-4 text-amber-500" />;
  return <AlertCircle className="h-4 w-4 text-rose-500" />;
}

// ─── Component ───
export function AdminDailyTargetsPage() {
  const [data, setData] = useState<ProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string>('');

  const fetchProgress = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      const res = await fetch(`/api/schedular/daily-targets/progress?${params}`);
      const json = await res.json();
      if (json.ok) {
        setData(json);
        const incomplete = json.clients
          .filter((c: ClientProgress) => c.progress < 100)
          .slice(0, 5)
          .map((c: ClientProgress) => c.clientId);
        setExpandedClients(new Set(incomplete));
      }
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const navigateDate = (direction: -1 | 1) => {
    // Parse date-only strings with explicit time to avoid UTC-midnight issues
    const base = selectedDate ? selectedDate : new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const [y, m, d] = base.split('-').map(Number);
    const next = new Date(y, m - 1, d + direction);
    setSelectedDate(next.toLocaleDateString('en-CA')); // always YYYY-MM-DD
  };

  const goToToday = () => setSelectedDate('');

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const s = new Set(prev);
      if (s.has(clientId)) s.delete(clientId); else s.add(clientId);
      return s;
    });
  };

  const togglePlatform = (key: string) => {
    setExpandedPlatforms(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  };

  const expandAll = () => {
    if (!data) return;
    setExpandedClients(new Set(data.clients.map(c => c.clientId)));
  };

  const collapseAll = () => {
    setExpandedClients(new Set());
    setExpandedPlatforms(new Set());
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
              <Target className="h-6 w-6 text-white" />
            </div>
            Daily Posting Tracker
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Track scheduler posting compliance per platform per client (EST)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {data && (
            <div className={cn(
              "px-4 py-2 rounded-xl text-white font-bold text-lg",
              `bg-gradient-to-r ${getProgressColor(data.grandProgress)}`
            )}>
              {data.grandCompleted}/{data.grandTotal} today
            </div>
          )}

          <div className="flex items-center gap-1 border rounded-lg px-1 py-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs font-medium" onClick={goToToday}>
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              {data ? formatDateEST(data.date) : 'Today'}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={fetchProgress} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      )}

      {data?.isSunday && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <Calendar className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            Sunday — weekly LF targets are active today
          </span>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.clients.map((client) => {
            const isExpanded = expandedClients.has(client.clientId);
            const isDone = client.progress >= 100;

            return (
              <div
                key={client.clientId}
                className={cn(
                  "bg-white rounded-2xl border shadow-sm overflow-hidden transition-all duration-200",
                  isExpanded && "ring-2 ring-indigo-100",
                  isDone && "opacity-75"
                )}
              >
                <button
                  onClick={() => toggleClient(client.clientId)}
                  className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md",
                      isDone
                        ? "bg-gradient-to-br from-emerald-400 to-teal-500"
                        : client.progress >= 50
                          ? "bg-gradient-to-br from-amber-400 to-orange-500"
                          : "bg-gradient-to-br from-rose-400 to-pink-500"
                    )}>
                      {isDone ? <CheckCircle2 className="h-6 w-6" /> : client.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-gray-900 text-lg">{client.clientName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {client.platforms.length} platform{client.platforms.length !== 1 ? 's' : ''} · {client.progress}% complete
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-3 min-w-[200px]">
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500 bg-gradient-to-r", getProgressColor(client.progress))}
                          style={{ width: `${Math.min(client.progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-600 min-w-[50px] text-right">
                        {client.totalCompleted}/{client.totalRequired}
                      </span>
                    </div>

                    <div className={cn(
                      "sm:hidden px-3 py-1.5 rounded-xl text-center min-w-[60px] text-white font-bold",
                      `bg-gradient-to-r ${getProgressColor(client.progress)}`
                    )}>
                      {client.totalCompleted}/{client.totalRequired}
                    </div>

                    <div className="p-2">
                      {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t bg-gray-50/50 p-5">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                            <th className="pb-3 font-semibold">Platform</th>
                            <th className="pb-3 font-semibold">Target</th>
                            <th className="pb-3 font-semibold">Progress</th>
                            <th className="pb-3 font-semibold text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {client.platforms.map((platform) => {
                            const pConfig = getPlatformConfig(platform.platform);
                            const Icon = pConfig.icon;
                            const platformKey = `${client.clientId}-${platform.platform}`;
                            const isPlatformExpanded = expandedPlatforms.has(platformKey);
                            const hasLinks = platform.deliverables.some(d => d.links.length > 0);

                            return (
                              <React.Fragment key={platform.platform}>
                                <tr
                                  className={cn("hover:bg-white transition-colors", hasLinks && "cursor-pointer")}
                                  onClick={() => hasLinks && togglePlatform(platformKey)}
                                >
                                  <td className="py-3">
                                    <div className={cn(
                                      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
                                      pConfig.bgColor, pConfig.color
                                    )}>
                                      {Icon && <Icon className="h-4 w-4" />}
                                      {platform.platform}
                                    </div>
                                  </td>
                                  <td className="py-3">
                                    <div className="flex flex-wrap gap-1.5">
                                      {platform.deliverables.map((d) => {
                                        const dColor = DELIVERABLE_COLORS[d.deliverableType] || { bg: 'bg-gray-100', text: 'text-gray-700' };
                                        const freqLabel = d.frequency === 'daily' ? '' : `/${d.frequency}`;
                                        return (
                                          <TooltipProvider key={d.deliverableType} delayDuration={200}>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <div className="inline-flex items-center gap-1">
                                                  <Badge className={cn(dColor.bg, dColor.text, `hover:${dColor.bg}`, !d.isActive && 'opacity-40')}>
                                                    {d.completed}/{d.required} {d.deliverableType}{freqLabel}
                                                  </Badge>
                                                  {d.extras?.tiles && (
                                                    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-[10px]">+Tiles</Badge>
                                                  )}
                                                  {d.extras?.thumb && (
                                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">+Thumb</Badge>
                                                  )}
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>{d.completed} of {d.required} {d.deliverableType} posted ({d.frequency})</p>
                                                {!d.isActive && <p className="text-amber-500">Not active today</p>}
                                                {d.extras?.note && <p className="text-muted-foreground">{d.extras.note}</p>}
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        );
                                      })}
                                    </div>
                                  </td>
                                  <td className="py-3">
                                    <div className="flex items-center gap-2 min-w-[120px]">
                                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className={cn("h-full rounded-full bg-gradient-to-r", getProgressColor(platform.progress))}
                                          style={{ width: `${Math.min(platform.progress, 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-medium text-gray-500">{platform.progress}%</span>
                                    </div>
                                  </td>
                                  <td className="py-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {getProgressIcon(platform.progress)}
                                      <span className="font-bold text-gray-900">
                                        {platform.totalCompleted}/{platform.totalRequired}
                                      </span>
                                      {hasLinks && (
                                        isPlatformExpanded
                                          ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                          : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                                      )}
                                    </div>
                                  </td>
                                </tr>

                                {isPlatformExpanded && (
                                  <tr>
                                    <td colSpan={4} className="py-2 px-4">
                                      <div className="bg-white rounded-lg border p-3 space-y-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                          Posted Links
                                        </p>
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
                                                {new Date(link.postedAt).toLocaleTimeString('en-US', {
                                                  timeZone: 'America/New_York',
                                                  hour: 'numeric',
                                                  minute: '2-digit',
                                                  hour12: true,
                                                })} EST
                                              </span>
                                              <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-indigo-500 hover:text-indigo-700"
                                              >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                              </a>
                                            </div>
                                          ))
                                        )}
                                        {platform.deliverables.every(d => d.links.length === 0) && (
                                          <p className="text-sm text-muted-foreground italic">No links posted yet</p>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data && data.clients.length === 0 && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <Target className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Posting Targets</h3>
            <p className="text-muted-foreground">
              No daily posting targets configured. Run the seed script to populate targets.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}