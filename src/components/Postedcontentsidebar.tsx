"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ExternalLink,
  Filter,
  Instagram,
  Youtube,
  Twitter,
  Facebook,
  Video,
  Calendar,
  X,
  Loader2,
  RefreshCw,
  ChevronDown,
  Search,
  LayoutGrid,
  List,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Platform colors & icons
const PLATFORM_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  instagram: {
    icon: <Instagram className="h-5 w-5" />,
    color: "bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600",
    label: "Instagram"
  },
  youtube: {
    icon: <Youtube className="h-5 w-5" />,
    color: "bg-red-600",
    label: "YouTube"
  },
  twitter: {
    icon: <Twitter className="h-5 w-5" />,
    color: "bg-sky-500",
    label: "Twitter"
  },
  facebook: {
    icon: <Facebook className="h-5 w-5" />,
    color: "bg-blue-700",
    label: "Facebook"
  },
  tiktok: {
    icon: <Video className="h-5 w-5" />,
    color: "bg-zinc-950",
    label: "TikTok"
  },
  snapchat: {
    icon: <span className="text-xl">👻</span>,
    color: "bg-yellow-400 text-black",
    label: "Snapchat"
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

  useEffect(() => { fetchPostedTasks(); }, [clientId]);

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

        if (matchesSearch && matchesPlatform && matchesType) {
          items.push({ task, link });
        }
      });
    });
    return items.sort((a, b) => new Date(b.link.postedAt).getTime() - new Date(a.link.postedAt).getTime());
  }, [tasks, searchQuery, selectedPlatforms, selectedDeliverable]);

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
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-gray-50/50">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-yellow-500" />
        <p className="text-sm font-medium text-gray-500 animate-pulse uppercase tracking-widest">Gathering your feed...</p>
      </div>
    </div>
  );

  return (
    <div className={cn("flex flex-col min-h-screen bg-[#fafafa] font-sans", className)}>
      {/* Premium Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-6 shadow-sm">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                {/* <LayoutGrid className="h-8 w-8 text-yellow-500" /> */}
                Posted Content Gallery
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-medium italic">
                A curated look at your brand's digital presence.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative group w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-yellow-500 transition-colors" />
                <Input
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-gray-50/50 border-gray-100 rounded-xl focus:ring-yellow-400 focus:border-yellow-400 transition-all text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchPostedTasks}
                className="h-10 w-10 rounded-xl border-gray-100 hover:bg-yellow-50 hover:text-yellow-600 hover:border-yellow-200 transition-all"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => {
                const isActive = selectedPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={cn(
                      "group relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all duration-300",
                      isActive
                        ? `${p.color} text-white border-transparent shadow-lg scale-105`
                        : "bg-white text-gray-400 border-gray-100 hover:border-gray-300 hover:text-gray-600"
                    )}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                    {isActive && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl border-gray-100 text-xs font-bold gap-2">
                    <Filter className="h-3.5 w-3.5" />
                    {selectedDeliverable || "All Content"}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-xl border-gray-100">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-gray-400">Choose Content Type</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ScrollArea className="h-64">
                    <DropdownMenuCheckboxItem
                      checked={!selectedDeliverable}
                      onCheckedChange={() => setSelectedDeliverable(null)}
                      className="text-xs font-bold py-2 rounded-lg m-1 text-yellow-600"
                    >
                      All Content Types
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {availableDeliverables.map(d => (
                      <DropdownMenuCheckboxItem
                        key={d}
                        checked={selectedDeliverable === d}
                        onCheckedChange={() => setSelectedDeliverable(d)}
                        className="text-xs font-medium py-2 rounded-lg m-1"
                      >
                        {d}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>

              {(searchQuery || selectedPlatforms.length > 0 || selectedDeliverable) && (
                <Button
                  variant="ghost"
                  onClick={() => { setSearchQuery(""); setSelectedPlatforms([]); setSelectedDeliverable(null); }}
                  className="h-10 w-10 p-0 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50"
                  title="Clear all filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewLayout('grid')}
                  className={cn("p-1.5 rounded-lg transition-all", viewLayout === 'grid' ? "bg-white text-yellow-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}
                ><LayoutGrid className="h-4 w-4" /></button>
                <button
                  onClick={() => setViewLayout('list')}
                  className={cn("p-1.5 rounded-lg transition-all", viewLayout === 'list' ? "bg-white text-yellow-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}
                ><List className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-8">
        {groupedByDate.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="w-24 h-24 rounded-3xl bg-gray-100 flex items-center justify-center mb-6 shadow-inner">
              <Video className="h-10 w-10 text-gray-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">No content found</h2>
            <p className="text-gray-500 mt-2 max-w-xs mx-auto">We couldn't find any posted content matching your current selection.</p>
            {(searchQuery || selectedPlatforms.length > 0 || selectedDeliverable) && (
              <Button
                variant="ghost"
                onClick={() => { setSearchQuery(""); setSelectedPlatforms([]); setSelectedDeliverable(null); }}
                className="mt-6 text-yellow-600 font-bold hover:bg-yellow-50"
              >
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-16">
            {groupedByDate.map(([date, items]) => (
              <section key={date} className="relative">
                {/* Date Vertical Line Indicator */}
                <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-yellow-200 via-gray-100 to-transparent hidden md:block" />

                <div className="flex items-center gap-4 mb-8">
                  <div className="p-2 bg-yellow-50 rounded-lg">
                    <Calendar className="h-4 w-4 text-yellow-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">{date}</h3>
                  <div className="flex-1 h-px bg-gray-100" />
                  <Badge variant="secondary" className="bg-white border-gray-100 text-gray-400 font-bold px-3 py-1 rounded-full shadow-sm">
                    {items.length} Post{items.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <div className={cn(
                  viewLayout === 'grid'
                    ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    : "flex flex-col gap-4"
                )}>
                  {items.map(({ task, link }, idx) => {
                    const cfg = PLATFORM_CONFIG[link.platform.toLowerCase()] || { icon: <Video />, color: "bg-gray-500", label: link.platform };

                    return (viewLayout === 'grid' ? (
                      <div
                        key={`${task.id}-${idx}`}
                        className="group relative bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-2xl hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shadow-gray-200", cfg.color)}>
                              {cfg.icon}
                            </div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              {new Date(link.postedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-gray-900 group-hover:text-yellow-600 transition-colors line-clamp-2 leading-tight mb-2">
                            {task.title}
                          </h4>
                          {task.deliverableType && (
                            <Badge variant="secondary" className="bg-gray-50 text-gray-400 text-[9px] font-bold uppercase tracking-tight py-0.5 px-2 rounded-md">
                              {task.deliverableType}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
                            <span className={cn("w-1.5 h-1.5 rounded-full", task.status?.toUpperCase() === 'POSTED' ? "bg-green-500" : "bg-blue-500")} />
                            {task.status?.toLowerCase()}
                          </span>
                          <button
                            onClick={() => window.open(link.url, "_blank")}
                            className="flex items-center gap-1.5 text-xs font-extrabold text-[#7c7c7c] hover:text-yellow-600 uppercase tracking-wider transition-colors"
                          >
                            View Post <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={`${task.id}-${idx}`}
                        className="group flex flex-col md:flex-row md:items-center justify-between bg-white rounded-xl border border-gray-100 p-4 hover:shadow-lg hover:border-yellow-200/50 transition-all cursor-pointer"
                        onClick={() => window.open(link.url, "_blank")}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm", cfg.color)}>
                            {cfg.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="text-sm font-bold text-gray-900 truncate tracking-tight">{task.title}</h4>
                              {task.deliverableType && (
                                <Badge variant="secondary" className="bg-gray-50 text-gray-400 text-[8px] font-bold uppercase py-0.5 px-1.5">
                                  {task.deliverableType}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 font-medium">
                              <span className="flex items-center gap-1 uppercase tracking-wider">
                                <Clock className="h-3 w-3" />
                                {new Date(link.postedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </span>
                              <span>•</span>
                              <span className="uppercase tracking-wider">Platform: {cfg.label}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-gray-50">
                          <Badge variant="outline" className={cn(
                            "text-[10px] font-bold uppercase px-3 py-1 rounded-full",
                            task.status?.toUpperCase() === 'POSTED' ? "border-green-200 text-green-600 bg-green-50/50" : "border-blue-200 text-blue-600 bg-blue-50/50"
                          )}>
                            {task.status}
                          </Badge>
                          <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-yellow-500 transition-colors" />
                        </div>
                      </div>
                    ));
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Subtle Footer */}
      <footer className="max-w-7xl mx-auto w-full px-8 py-12 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400 font-medium tracking-widest uppercase">
          E8 Productions • Automated Content Feed
        </p>
      </footer>
    </div>
  );
}
