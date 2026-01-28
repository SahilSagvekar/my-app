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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Platform icons mapping
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  twitter: <Twitter className="h-4 w-4" />,
  facebook: <Facebook className="h-4 w-4" />,
  tiktok: <Video className="h-4 w-4" />,
  snapchat: <span className="text-sm">👻</span>,
};

// Platform styles for pills
const PLATFORM_STYLES: Record<string, { active: string; inactive: string }> = {
  instagram: {
    active: "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-transparent",
    inactive: "text-pink-500 border-pink-200 hover:border-pink-400 hover:bg-pink-50",
  },
  youtube: {
    active: "bg-red-500 text-white border-transparent",
    inactive: "text-red-500 border-red-200 hover:border-red-400 hover:bg-red-50",
  },
  twitter: {
    active: "bg-blue-400 text-white border-transparent",
    inactive: "text-blue-400 border-blue-200 hover:border-blue-400 hover:bg-blue-50",
  },
  facebook: {
    active: "bg-blue-600 text-white border-transparent",
    inactive: "text-blue-600 border-blue-200 hover:border-blue-400 hover:bg-blue-50",
  },
  tiktok: {
    active: "bg-black text-white border-transparent",
    inactive: "text-black border-gray-300 hover:border-gray-500 hover:bg-gray-50",
  },
  snapchat: {
    active: "bg-yellow-400 text-black border-transparent",
    inactive: "text-yellow-600 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50",
  },
};

// Platform colors for content badges
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  youtube: "bg-red-500 text-white",
  twitter: "bg-blue-400 text-white",
  facebook: "bg-blue-600 text-white",
  tiktok: "bg-black text-white",
  snapchat: "bg-yellow-400 text-black",
};

// Available platforms
const ALL_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "Youtube" },
  { id: "twitter", label: "Twitter" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "snapchat", label: "Snapchat" },
];

// Actual deliverable types used in the system
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

// Helper to normalize deliverable types
const normalizeDeliverableType = (type: string | undefined | null): string => {
  if (!type) return "";
  const t = type.trim();
  const lower = t.toLowerCase();

  // Map common short codes to full names
  if (lower === "sf" || lower === "short_form") return "Short Form Videos";
  if (lower === "lf" || lower === "long_form") return "Long Form Videos";
  if (lower === "sqf" || lower === "square_form") return "Square Form Videos";
  if (lower === "thumb" || lower === "thumbnail") return "Thumbnails";
  if (lower === "t" || lower === "tile") return "Tiles";
  if (lower === "hp" || lower === "hard_post") return "Hard Posts / Graphic Images";
  if (lower === "sep" || lower === "snapchat_episode") return "Snapchat Episodes";
  if (lower === "bsf" || lower === "beta_short_form") return "Beta Short Form";
  if (lower === "reel") return "Reel";
  if (lower === "story") return "Story";
  if (lower === "post") return "Post";

  // Default: Title Case if it's a known multi-word type, otherwise just return as is
  return t;
};

interface PostedContentSidebarProps {
  clientId?: string;
  className?: string;
}

export function PostedContentSidebar({
  clientId,
  className,
}: PostedContentSidebarProps) {
  const [tasks, setTasks] = useState<PostedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>([]);

  // Fetch posted tasks from backend
  const fetchPostedTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/tasks", { cache: "no-store" });

      if (!res.ok) {
        throw new Error("Failed to fetch tasks");
      }

      const data = await res.json();

      // Filter for scheduled tasks (posted content) with social media links
      const postedTasks = (data.tasks || [])
        .filter((task: any) => {
          const isScheduled = task.status === "SCHEDULED";
          let links = task.socialMediaLinks;
          if (typeof links === "string") {
            try {
              links = JSON.parse(links);
            } catch {
              links = [];
            }
          }
          const hasLinks = Array.isArray(links) && links.length > 0;
          return isScheduled && hasLinks;
        })
        .map((task: any) => {
          let smLinks = task.socialMediaLinks;
          if (typeof smLinks === "string") {
            try {
              smLinks = JSON.parse(smLinks);
            } catch {
              smLinks = [];
            }
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
      console.error("Error fetching posted tasks:", err);
      setError("Failed to load posted content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostedTasks();
  }, [clientId]);

  // Extract unique deliverable types from tasks (actual deliverableType field only)
  const availableDeliverables = useMemo(() => {
    // Use an object as a map to store normalized -> original/formatted pairs
    // This prevents duplicates like "Reel" and "REEL"
    const typeMap = new Map<string, string>();

    // Helper to format string to Title Case
    const formatType = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    // Always include common types to ensure the filter displays
    DELIVERABLE_TYPES.forEach(t => {
      typeMap.set(t.toLowerCase(), t);
    });

    tasks.forEach((task) => {
      const type = task.deliverableType;
      if (type && !typeMap.has(type.toLowerCase())) {
        typeMap.set(type.toLowerCase(), type);
      }
    });

    return Array.from(typeMap.values()).sort();
  }, [tasks]);

  // Filter tasks based on selected filters
  const filteredContent = useMemo(() => {
    const allContent: Array<{
      task: PostedTask;
      link: SocialMediaLink;
    }> = [];

    tasks.forEach((task) => {
      if (task.socialMediaLinks && task.socialMediaLinks.length > 0) {
        task.socialMediaLinks.forEach((link) => {
          allContent.push({ task, link });
        });
      }
    });

    return allContent.filter(({ task, link }) => {
      if (
        selectedPlatforms.length > 0 &&
        !selectedPlatforms.includes((link.platform || "").toLowerCase().trim())
      ) {
        return false;
      }

      if (selectedDeliverables.length > 0) {
        const taskType = (task.deliverableType || "").trim(); // Already normalized in fetch
        if (!taskType) return false;

        const isMatched = selectedDeliverables.some(
          d => d.trim() === taskType
        );

        if (!isMatched) return false;
      }

      return true;
    });
  }, [tasks, selectedPlatforms, selectedDeliverables]);

  // Group content by date
  const groupedByDate = useMemo(() => {
    const groups: Record<
      string,
      Array<{ task: PostedTask; link: SocialMediaLink }>
    > = {};

    filteredContent.forEach((item) => {
      const date = new Date(item.link.postedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(item);
    });

    return Object.entries(groups).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [filteredContent]);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const toggleDeliverable = (deliverable: string) => {
    setSelectedDeliverables((prev) =>
      prev.includes(deliverable)
        ? prev.filter((d) => d !== deliverable)
        : [...prev, deliverable]
    );
  };

  const clearFilters = () => {
    setSelectedPlatforms([]);
    setSelectedDeliverables([]);
  };

  const hasActiveFilters =
    selectedPlatforms.length > 0 || selectedDeliverables.length > 0;

  // Loading state
  if (loading) {
    return (
      <div className={cn("flex flex-col h-full bg-background", className)}>
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Posted Content</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("flex flex-col h-full bg-background", className)}>
        <div className="px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Posted Content</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4">
          <p className="text-sm text-muted-foreground text-center">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPostedTasks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Posted Content</h3>
            <Badge variant="outline" className="text-xs font-normal">
              {filteredContent.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchPostedTasks}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Compact Filters */}
      <div className="px-3 py-2.5 border-b space-y-2.5">
        {/* Platform Pills - Horizontal */}
        <div className="flex flex-wrap gap-1.5">
          {ALL_PLATFORMS.map((platform) => {
            const isActive = selectedPlatforms.includes(platform.id);
            const styles = PLATFORM_STYLES[platform.id];
            return (
              <button
                key={platform.id}
                onClick={() => togglePlatform(platform.id)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-all",
                  isActive ? styles.active : styles.inactive
                )}
              >
                {PLATFORM_ICONS[platform.id]}
                <span>{platform.label}</span>
              </button>
            );
          })}
        </div>

        {/* Deliverables Dropdown + Clear */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 flex-1 justify-between"
              >
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3 w-3" />
                  <span>
                    {selectedDeliverables.length > 0
                      ? `${selectedDeliverables.length} type${selectedDeliverables.length > 1 ? "s" : ""}`
                      : "All Types"}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-xs">
                Deliverable Types
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableDeliverables.length > 0 ? (
                availableDeliverables.map((deliverable) => (
                  <DropdownMenuCheckboxItem
                    key={deliverable}
                    checked={selectedDeliverables.includes(deliverable)}
                    onCheckedChange={() => toggleDeliverable(deliverable)}
                  >
                    {deliverable}
                  </DropdownMenuCheckboxItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No deliverable types found
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Content List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {groupedByDate.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Video className="h-6 w-6 opacity-50" />
              </div>
              <p className="text-sm font-medium">No posted content</p>
              {hasActiveFilters && (
                <p className="text-xs mt-1 text-muted-foreground/70">
                  Try adjusting your filters
                </p>
              )}
            </div>
          ) : (
            groupedByDate.map(([date, items]) => (
              <div key={date} className="space-y-1.5">
                {/* Date Header */}
                <div className="flex items-center gap-2 px-2 sticky top-0 bg-background py-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {date}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Posts for this date */}
                <div className="space-y-1.5">
                  {items.map(({ task, link }, index) => (
                    <button
                      key={`${task.id}-${link.platform}-${index}`}
                      onClick={() => window.open(link.url, "_blank")}
                      className="w-full text-left p-2.5 rounded-lg border bg-card hover:bg-accent/50 hover:border-accent transition-all group"
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Platform Icon with background */}
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            PLATFORM_COLORS[link.platform.toLowerCase()] ||
                            "bg-gray-500 text-white"
                          )}
                        >
                          {PLATFORM_ICONS[link.platform.toLowerCase()] || (
                            <Video className="h-4 w-4" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.deliverableType && (
                              <span className="text-xs text-muted-foreground">
                                {task.deliverableType}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground/60">
                              •
                            </span>
                            <span className="text-xs text-muted-foreground/60">
                              {new Date(link.postedAt).toLocaleTimeString(
                                "en-US",
                                {
                                  hour: "numeric",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </div>
                        </div>

                        {/* External Link Icon */}
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}