"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ExternalLink,
  Instagram,
  Youtube,
  Twitter,
  Facebook,
  Video,
  Calendar,
  Loader2,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  Clock,
  CheckCircle,
  Filter,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Platform colors & icons — using the app's zinc/neutral palette for inactive states
const PLATFORM_CONFIG: Record<string, { icon: React.ReactNode; color: string; activeBg: string; label: string }> = {
  instagram: {
    icon: <Instagram className="h-4 w-4" />,
    color: "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600",
    activeBg: "bg-pink-50 text-pink-700 border-pink-200",
    label: "Instagram",
  },
  youtube: {
    icon: <Youtube className="h-4 w-4" />,
    color: "bg-red-600",
    activeBg: "bg-red-50 text-red-700 border-red-200",
    label: "YouTube",
  },
  twitter: {
    icon: <Twitter className="h-4 w-4" />,
    color: "bg-sky-500",
    activeBg: "bg-sky-50 text-sky-700 border-sky-200",
    label: "Twitter",
  },
  facebook: {
    icon: <Facebook className="h-4 w-4" />,
    color: "bg-blue-700",
    activeBg: "bg-blue-50 text-blue-700 border-blue-200",
    label: "Facebook",
  },
  tiktok: {
    icon: <Video className="h-4 w-4" />,
    color: "bg-zinc-950",
    activeBg: "bg-zinc-100 text-zinc-700 border-zinc-300",
    label: "TikTok",
  },
  snapchat: {
    icon: <span className="text-sm">👻</span>,
    color: "bg-yellow-400 text-black",
    activeBg: "bg-yellow-50 text-yellow-700 border-yellow-200",
    label: "Snapchat",
  },
};

const ALL_PLATFORMS = Object.entries(PLATFORM_CONFIG).map(([id, cfg]) => ({ id, ...cfg }));

const DELIVERABLE_TYPES = [
  "Short Form Videos",
  "Long Form Videos",
  "Square Form Videos",
  "Thumbnails",
  "Tiles",
  "Hard Posts / Graphic Images",
  "Snapchat Episodes",
  "Beta Short Form",
];

interface SocialMediaLink {
  platform: string;
  url: string;
  postedAt: string;
}

interface PostedTask {
  id: string;
  title: string;
  deliverableType?: string;
  socialMediaLinks: SocialMediaLink[];
  completedAt?: string;
  status?: string;
}

const normalizeDeliverableType = (type: string | undefined | null): string => {
  if (!type) return "";
  const t = type.trim();
  const lower = t.toLowerCase();
  if (lower === "sf" || lower === "short_form") return "Short Form Videos";
  if (lower === "lf" || lower === "long_form") return "Long Form Videos";
  if (lower === "sqf" || lower === "square_form") return "Square Form Videos";
  if (lower === "thumb" || lower === "thumbnail") return "Thumbnails";
  if (lower === "t" || lower === "tile") return "Tiles";
  if (lower === "hp" || lower === "hard_post") return "Hard Posts / Graphic Images";
  if (lower === "sep" || lower === "snapchat_episode") return "Snapchat Episodes";
  if (lower === "bsf" || lower === "beta_short_form") return "Beta Short Form";
  return t;
};

interface PostedContentSidebarProps {
  clientId?: string;
  className?: string;
}

export function PostedContentSidebar({ clientId, className }: PostedContentSidebarProps) {
  const [tasks, setTasks] = useState<PostedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedDeliverable, setSelectedDeliverable] = useState<string | null>(null);
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'scheduled'>('all');

  const fetchPostedTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = clientId
        ? `/api/tasks?clientId=${clientId}&status=SCHEDULED,POSTED`
        : "/api/tasks?status=SCHEDULED,POSTED";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();

      const postedTasks = (data.tasks || [])
        .filter((task: any) => {
          const status = (task.status || "").toUpperCase();
          const isValidStatus = status === "SCHEDULED" || status === "POSTED";
          let links = task.socialMediaLinks;
          if (typeof links === "string") {
            try { links = JSON.parse(links); } catch { links = []; }
          }
          return isValidStatus && Array.isArray(links) && links.length > 0;
        })
        .map((task: any) => {
          let smLinks = task.socialMediaLinks;
          if (typeof smLinks === "string") {
            try { smLinks = JSON.parse(smLinks); } catch { smLinks = []; }
          }
          return {
            id: task.id,
            title: task.title,
            deliverableType: normalizeDeliverableType(task.deliverableType || task.monthlyDeliverable?.type),
            socialMediaLinks: smLinks || [],
            completedAt: task.completedAt,
            status: task.status,
          };
        });

      setTasks(postedTasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      setError("Failed to load posted content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostedTasks();
  }, [clientId]);

  const availableDeliverables = useMemo(() => {
    const typeMap = new Map<string, string>();
    DELIVERABLE_TYPES.forEach(t => typeMap.set(t.toLowerCase(), t));
    tasks.forEach(t => {
      if (t.deliverableType) typeMap.set(t.deliverableType.toLowerCase(), t.deliverableType);
    });
    return Array.from(typeMap.values()).sort();
  }, [tasks]);

  const filteredItems = useMemo(() => {
    const items: Array<{ task: PostedTask; link: SocialMediaLink }> = [];
    tasks.forEach(task => {
      task.socialMediaLinks.forEach(link => {
        const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPlatform = selectedPlatforms.length === 0 || selectedPlatforms.includes(link.platform.toLowerCase());
        const matchesType = !selectedDeliverable || (task.deliverableType === selectedDeliverable);
        const matchesStatus =
          statusFilter === 'all' ||
          (statusFilter === 'posted' && task.status?.toUpperCase() === 'POSTED') ||
          (statusFilter === 'scheduled' && task.status?.toUpperCase() === 'SCHEDULED');

        if (matchesSearch && matchesPlatform && matchesType && matchesStatus) {
          items.push({ task, link });
        }
      });
    });
    return items.sort((a, b) => new Date(b.link.postedAt).getTime() - new Date(a.link.postedAt).getTime());
  }, [tasks, searchQuery, selectedPlatforms, selectedDeliverable, statusFilter]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {};
    filteredItems.forEach(item => {
      const date = new Date(item.link.postedAt).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return Object.entries(groups);
  }, [filteredItems]);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // Stats
  const postedCount = tasks.filter(t => t.status?.toUpperCase() === 'POSTED').length;
  const scheduledCount = tasks.filter(t => t.status?.toUpperCase() === 'SCHEDULED').length;
  const totalLinks = tasks.reduce((sum, t) => sum + t.socialMediaLinks.length, 0);
  const hasActiveFilters = searchQuery || selectedPlatforms.length > 0 || selectedDeliverable;

  /* ─── Loading ─── */
  if (loading) return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Posted Content</h1>
          <p className="text-muted-foreground mt-1 text-lg">View all your published content across platforms</p>
        </div>
      </div>
      <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
        <Loader2 className="h-12 w-12 mx-auto mb-4 opacity-40 animate-spin" />
        <p className="font-medium">Loading posted content...</p>
      </div>
    </div>
  );

  /* ─── Render ─── */
  return (
    <TooltipProvider>
      <div className={cn("flex flex-col h-full space-y-6", className)}>
        {/* Page Header & Filter Row — matches ClientDashboard exactly */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Posted Content</h1>
            <p className="text-muted-foreground mt-1 text-lg">
              View all your published content across platforms
            </p>
          </div>

          {/* <div className="flex items-center gap-4">
            <Tabs
              value={statusFilter}
              onValueChange={(val: any) => setStatusFilter(val)}
              className="w-full lg:w-auto"
            >
              <TabsList className="bg-zinc-100 p-1">
                <TabsTrigger
                  value="all"
                  className="px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium flex items-center gap-2"
                >
                  All
                  {totalLinks > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-zinc-200/50">
                      {totalLinks}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="posted"
                  className="px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium flex items-center gap-2"
                >
                  Posted
                  {postedCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-zinc-200/50">
                      {postedCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="scheduled"
                  className="px-4 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg text-xs font-medium flex items-center gap-2"
                >
                  Scheduled
                  {scheduledCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-zinc-200/50">
                      {scheduledCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div> */}
        </div>

        {/* Toolbar Row — Search, Platform Filters, Content Type, Layout Toggle */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Platform pills + Search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-56 bg-white border-zinc-200 rounded-lg text-sm focus:ring-zinc-400 focus:border-zinc-400"
              />
            </div>

            <div className="flex items-center gap-1.5">
              {ALL_PLATFORMS.map((p) => {
                const isActive = selectedPlatforms.includes(p.id);
                return (
                  <Tooltip key={p.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => togglePlatform(p.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
                          isActive
                            ? p.activeBg
                            : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-300 hover:text-zinc-700"
                        )}
                      >
                        {p.icon}
                        <span className="hidden sm:inline">{p.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-xl border-none">
                      <p>{isActive ? `Remove ${p.label} filter` : `Filter by ${p.label}`}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Right: Content type dropdown + Layout toggle + Refresh */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-3 rounded-lg border-zinc-200 text-xs font-medium gap-2">
                  <Filter className="h-3.5 w-3.5" />
                  {selectedDeliverable || "All Types"}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-lg shadow-lg border-zinc-200">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-zinc-400">Content Type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="h-64">
                  <DropdownMenuCheckboxItem
                    checked={!selectedDeliverable}
                    onCheckedChange={() => setSelectedDeliverable(null)}
                    className="text-xs font-medium py-2 rounded-md m-1"
                  >
                    All Content Types
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  {availableDeliverables.map(d => (
                    <DropdownMenuCheckboxItem
                      key={d}
                      checked={selectedDeliverable === d}
                      onCheckedChange={() => setSelectedDeliverable(d)}
                      className="text-xs font-medium py-2 rounded-md m-1"
                    >
                      {d}
                    </DropdownMenuCheckboxItem>
                  ))}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasActiveFilters && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedPlatforms([]);
                      setSelectedDeliverable(null);
                    }}
                    className="h-9 w-9 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-xl border-none">
                  <p>Clear all filters</p>
                </TooltipContent>
              </Tooltip>
            )}

            <div className="flex bg-zinc-100 p-0.5 rounded-lg">
              <button
                onClick={() => setViewLayout('grid')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewLayout === 'grid' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewLayout('list')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  viewLayout === 'list' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchPostedTasks}
                  className="h-9 w-9 rounded-lg border-zinc-200 hover:bg-zinc-50"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-xl border-none">
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {groupedByDate.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground w-full border-2 border-dashed rounded-2xl bg-muted/20">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-40 text-emerald-500" />
              <p className="font-medium">No posted content found</p>
              <p className="text-sm mt-1">
                {hasActiveFilters
                  ? "Try adjusting your filters"
                  : "Content will appear here once it's posted"}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSearchQuery(""); setSelectedPlatforms([]); setSelectedDeliverable(null); }}
                  className="mt-4 text-zinc-600 hover:text-zinc-900"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-10">
              {groupedByDate.map(([date, items]) => (
                <section key={date}>
                  {/* Date header */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Calendar className="h-4 w-4" />
                      <h3 className="text-sm font-semibold tracking-tight">{date}</h3>
                    </div>
                    <div className="flex-1 h-px bg-zinc-100" />
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-zinc-100 text-zinc-500 font-medium">
                      {items.length} {items.length === 1 ? 'post' : 'posts'}
                    </Badge>
                  </div>

                  {/* Cards */}
                  <div className={cn(
                    viewLayout === 'grid'
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6"
                      : "flex flex-col gap-3"
                  )}>
                    {items.map(({ task, link }, idx) => {
                      const cfg = PLATFORM_CONFIG[link.platform.toLowerCase()] || {
                        icon: <Video className="h-4 w-4" />,
                        color: "bg-zinc-500",
                        activeBg: "bg-zinc-100 text-zinc-700 border-zinc-300",
                        label: link.platform,
                      };

                      return viewLayout === 'grid' ? (
                        /* ─── Grid Card — matches ClientDashboard card style ─── */
                        <div
                          key={`${task.id}-${idx}`}
                          className="group cursor-pointer border-none shadow-sm transition-all duration-300 rounded-[1.25rem] overflow-hidden flex flex-col bg-white hover:shadow-md hover:ring-1 hover:ring-zinc-200"
                          onClick={() => window.open(link.url, "_blank")}
                        >
                          {/* Visual Header */}
                          <div className="h-32 relative flex items-center justify-center bg-zinc-50">
                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm", cfg.color)}>
                              {cfg.icon}
                            </div>

                            {/* Status pill — top right */}
                            <div className="absolute top-3 right-3">
                              <Badge className={cn(
                                "border-none rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1",
                                task.status?.toUpperCase() === 'POSTED'
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-blue-50 text-blue-600"
                              )}>
                                {task.status?.toUpperCase() === 'POSTED' ? (
                                  <><CheckCircle className="h-2.5 w-2.5" /> Posted</>
                                ) : (
                                  <><Clock className="h-2.5 w-2.5" /> Scheduled</>
                                )}
                              </Badge>
                            </div>

                            {/* Platform label — top left */}
                            <div className="absolute top-3 left-3">
                              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/80 text-zinc-700 text-[11px] font-semibold border border-zinc-200/50 shadow-sm backdrop-blur-sm">
                                {cfg.icon}
                                {cfg.label}
                              </div>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-4 flex flex-col gap-2">
                            <h4 className="text-zinc-900 font-bold text-sm line-clamp-2 group-hover:text-zinc-700 transition-colors">
                              {task.title}
                            </h4>

                            <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(link.postedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </div>

                              <div className="flex items-center gap-1 text-zinc-400 group-hover:text-zinc-600 transition-colors">
                                <ExternalLink className="h-3 w-3" />
                                <span className="text-[10px] font-medium">View</span>
                              </div>
                            </div>

                            {task.deliverableType && (
                              <Badge variant="secondary" className="w-fit bg-zinc-50 text-zinc-500 text-[9px] font-medium px-2 py-0.5 rounded-md border-none">
                                {task.deliverableType}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* ─── List Row — consistent with app style ─── */
                        <div
                          key={`${task.id}-${idx}`}
                          className="group flex items-center justify-between bg-white rounded-xl border border-zinc-100 p-4 hover:shadow-sm hover:ring-1 hover:ring-zinc-200 transition-all cursor-pointer"
                          onClick={() => window.open(link.url, "_blank")}
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm", cfg.color)}>
                              {cfg.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-zinc-900 truncate">{task.title}</h4>
                                {task.deliverableType && (
                                  <Badge variant="secondary" className="bg-zinc-50 text-zinc-400 text-[9px] font-medium py-0.5 px-1.5 border-none hidden sm:flex">
                                    {task.deliverableType}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-400">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(link.postedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                </span>
                                <span>•</span>
                                <span>{cfg.label}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <Badge className={cn(
                              "border-none rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                              task.status?.toUpperCase() === 'POSTED'
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-blue-50 text-blue-600"
                            )}>
                              {task.status?.toUpperCase() === 'POSTED' ? 'Posted' : 'Scheduled'}
                            </Badge>
                            <ExternalLink className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500 transition-colors" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
