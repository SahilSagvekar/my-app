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
  ChevronDown,
  ChevronRight,
  Calendar,
  X,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Platform icons mapping
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  youtube: <Youtube className="h-4 w-4 text-red-500" />,
  twitter: <Twitter className="h-4 w-4 text-blue-400" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600" />,
  tiktok: <Video className="h-4 w-4 text-black" />,
  snapchat: <span className="text-yellow-400 text-sm">👻</span>,
};

// Platform colors for badges
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
  { id: "youtube", label: "YouTube" },
  { id: "twitter", label: "Twitter/X" },
  { id: "facebook", label: "Facebook" },
  { id: "tiktok", label: "TikTok" },
  { id: "snapchat", label: "Snapchat" },
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
  const [isFilterOpen, setIsFilterOpen] = useState(true);
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
          // Only include tasks that are "scheduled" (posted)
          const isScheduled = task.status === "SCHEDULED";
          
          // Parse socialMediaLinks if it's a string
          let links = task.socialMediaLinks;
          if (typeof links === "string") {
            try {
              links = JSON.parse(links);
            } catch {
              links = [];
            }
          }
          
          // Must have at least one social media link
          const hasLinks = Array.isArray(links) && links.length > 0;
          
          return isScheduled && hasLinks;
        })
        .map((task: any) => {
          // Parse socialMediaLinks if needed
          let socialMediaLinks = task.socialMediaLinks;
          if (typeof socialMediaLinks === "string") {
            try {
              socialMediaLinks = JSON.parse(socialMediaLinks);
            } catch {
              socialMediaLinks = [];
            }
          }

          return {
            id: task.id,
            title: task.title,
            deliverableType: task.deliverableType || task.title,
            socialMediaLinks: socialMediaLinks || [],
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

  // Fetch on mount
  useEffect(() => {
    fetchPostedTasks();
  }, [clientId]);

  // Extract unique deliverable types from tasks
  const deliverableTypes = useMemo(() => {
    const types = new Set<string>();
    tasks.forEach((task) => {
      if (task.deliverableType) {
        types.add(task.deliverableType);
      } else {
        types.add(task.title);
      }
    });
    return Array.from(types).sort();
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
      // Platform filter
      if (
        selectedPlatforms.length > 0 &&
        !selectedPlatforms.includes(link.platform.toLowerCase())
      ) {
        return false;
      }

      // Deliverable filter
      const deliverable = task.deliverableType || task.title;
      if (
        selectedDeliverables.length > 0 &&
        !selectedDeliverables.includes(deliverable)
      ) {
        return false;
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
      <div className={cn("flex flex-col h-full", className)}>
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
      <div className={cn("flex flex-col h-full", className)}>
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
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Posted Content</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {filteredContent.length} posts
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={fetchPostedTasks}
              title="Refresh"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between px-4 py-2 h-auto"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filters</span>
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  {selectedPlatforms.length + selectedDeliverables.length}
                </Badge>
              )}
            </div>
            {isFilterOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-4">
            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full justify-center text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all filters
              </Button>
            )}

            {/* Platform Filters */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Platforms
              </p>
              <div className="space-y-1">
                {ALL_PLATFORMS.map((platform) => (
                  <label
                    key={platform.id}
                    className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedPlatforms.includes(platform.id)}
                      onCheckedChange={() => togglePlatform(platform.id)}
                    />
                    <span className="flex items-center gap-2 text-sm">
                      {PLATFORM_ICONS[platform.id]}
                      {platform.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            {/* Deliverable Filters */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Deliverables
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {deliverableTypes.map((deliverable) => (
                  <label
                    key={deliverable}
                    className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedDeliverables.includes(deliverable)}
                      onCheckedChange={() => toggleDeliverable(deliverable)}
                    />
                    <span className="text-sm truncate">{deliverable}</span>
                  </label>
                ))}
                {deliverableTypes.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">
                    No deliverables found
                  </p>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Content List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-4">
          {groupedByDate.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No posted content yet</p>
              {hasActiveFilters && (
                <p className="text-xs mt-1">Try adjusting your filters</p>
              )}
            </div>
          ) : (
            groupedByDate.map(([date, items]) => (
              <div key={date} className="space-y-2">
                {/* Date Header */}
                <div className="flex items-center gap-2 px-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {date}
                  </span>
                </div>

                {/* Posts for this date */}
                <div className="space-y-1">
                  {items.map(({ task, link }, index) => (
                    <button
                      key={`${task.id}-${link.platform}-${index}`}
                      onClick={() => window.open(link.url, "_blank")}
                      className="w-full text-left p-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-start gap-2">
                        {/* Platform Icon */}
                        <div className="mt-0.5">
                          {PLATFORM_ICONS[link.platform.toLowerCase()] || (
                            <Video className="h-4 w-4" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary">
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              className={cn(
                                "text-xs capitalize",
                                PLATFORM_COLORS[link.platform.toLowerCase()] ||
                                  "bg-gray-500 text-white"
                              )}
                            >
                              {link.platform}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
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
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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