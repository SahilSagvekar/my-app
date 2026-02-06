// src/components/youtube/YouTubeStudio.tsx
// Client-facing YouTube analytics - like YouTube Studio but simpler
// Shows: subscribers, views, watch time, revenue, charts, top videos

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useYouTubeAnalytics } from "@/lib/hooks/useYouTubeAnalytics";
import type { DateRange, DailyMetric } from "@/types/youtube";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Youtube,
  Eye,
  Clock,
  DollarSign,
  Users,
  ThumbsUp,
  MessageSquare,
  TrendingUp,
  ExternalLink,
  Play,
  Globe,
  Tablet,
  Smartphone,
  Monitor,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// ============================================================================
// HELPERS
// ============================================================================

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatRevenue(amount: number | null): string {
  if (amount == null) return "—";
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getChangeIndicator(change: number) {
  if (change > 0)
    return (
      <span className="flex items-center gap-1 text-sm text-emerald-500 font-medium">
        <ArrowUp className="w-3 h-3" />+{formatNumber(change)}
      </span>
    );
  if (change < 0)
    return (
      <span className="flex items-center gap-1 text-sm text-red-500 font-medium">
        <ArrowDown className="w-3 h-3" />{formatNumber(change)}
      </span>
    );
  return <span className="text-sm text-muted-foreground">No change</span>;
}

const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "28d", label: "Last 28 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 365 days" },
];

// ============================================================================
// MINI CHART - Simple sparkline using SVG (no library needed)
// ============================================================================

function Sparkline({
  data,
  dataKey,
  color = "#10b981",
  height = 40,
  width = 120,
}: {
  data: DailyMetric[];
  dataKey: keyof DailyMetric;
  color?: string;
  height?: number;
  width?: number;
}) {
  if (!data || data.length < 2) return null;

  const values = data.map((d) => Number(d[dataKey]) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================================
// BAR CHART - Simple bar chart for daily views
// ============================================================================

function DailyBarChart({
  data,
  dataKey,
  color = "#10b981",
}: {
  data: DailyMetric[];
  dataKey: keyof DailyMetric;
  color?: string;
}) {
  if (!data || data.length === 0) return null;

  const values = data.map((d) => Number(d[dataKey]) || 0);
  const max = Math.max(...values) || 1;

  return (
    <div className="w-full">
      <div className="flex items-end gap-[2px] h-[140px]">
        {data.map((d, i) => {
          const value = Number(d[dataKey]) || 0;
          const heightPercent = (value / max) * 100;

          return (
            <div
              key={i}
              className="flex-1 group relative cursor-pointer"
              style={{ height: "100%" }}
            >
              <div className="absolute bottom-0 w-full rounded-t-sm transition-opacity hover:opacity-80"
                style={{
                  height: `${Math.max(heightPercent, 2)}%`,
                  backgroundColor: color,
                  opacity: 0.7,
                }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-zinc-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  <div className="font-medium">{formatNumber(value)}</div>
                  <div className="text-zinc-400">
                    {new Date(d.date).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>
          {data[0] &&
            new Date(data[0].date).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
            })}
        </span>
        <span>
          {data[data.length - 1] &&
            new Date(data[data.length - 1].date).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
            })}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// CONNECT PROMPT
// ============================================================================

function ConnectYouTube({ clientId }: { clientId: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <Youtube className="w-8 h-8 text-red-600" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">Connect YouTube Channel</h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-md">
            Connect your YouTube channel to see subscribers, views, watch time,
            revenue, and more — all in one place.
          </p>
        </div>
        <Button
          className="bg-red-600 hover:bg-red-700 text-white"
          onClick={() => {
            localStorage.setItem("returnToPage", "youtube-analytics");
            window.location.href = `/api/youtube/connect?clientId=${clientId}`;
          }}
        >
          <Youtube className="w-4 h-4 mr-2" />
          Connect YouTube
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface YouTubeStudioProps {
  clientId: string;
}

export default function YouTubeStudio({ clientId }: YouTubeStudioProps) {
  const { data, loading, syncing, error, range, setRange, triggerSync } =
    useYouTubeAnalytics(clientId);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("youtube_connected") === "true") {
      toast.success("YouTube channel connected successfully!");
      // Clean up URL
      url.searchParams.delete("youtube_connected");
      window.history.replaceState({}, "", url.pathname + url.search);
      // Trigger a sync
      triggerSync();
    }
    if (url.searchParams.get("youtube_error")) {
      toast.error(`Failed to connect YouTube: ${url.searchParams.get("youtube_error")}`);
      url.searchParams.delete("youtube_error");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [triggerSync]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-10 w-36 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-4 w-20 bg-muted animate-pulse rounded mb-3" />
                <div className="h-8 w-28 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Not connected
  if (!data?.connected) {
    return <ConnectYouTube clientId={clientId} />;
  }

  // Error
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const {
    channelTitle,
    channelAvatar,
    currentSubscribers,
    subscriberChange,
    viewsInPeriod,
    watchTimeHours,
    estimatedRevenue,
    avgViewDuration,
    totalLikes,
    totalComments,
    topVideos,
    dailyData,
    distribution,
    lastSyncedAt,
    syncStatus,
  } = data;

  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label || "Last 28 days";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {channelAvatar && (
            <img
              src={channelAvatar}
              alt={channelTitle}
              className="w-10 h-10 rounded-full"
            />
          )}
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {channelTitle || "YouTube Analytics"}
              <Youtube className="w-5 h-5 text-red-600" />
            </h2>
            {lastSyncedAt && (
              <p className="text-xs text-muted-foreground">
                Last updated:{" "}
                {new Date(lastSyncedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={range}
            onValueChange={(v) => setRange(v as DateRange)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={triggerSync}
            disabled={syncing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Syncing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Metric Cards - matching YouTube Studio screenshot layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Subscribers */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">
                Current subscribers
              </p>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold mt-1 tracking-tight">
              {formatNumber(currentSubscribers)}
            </p>
            <div className="flex items-center justify-between mt-2">
              {getChangeIndicator(subscriberChange)}
              <span className="text-xs text-muted-foreground">
                in {rangeLabel.toLowerCase()}
              </span>
            </div>
            <div className="mt-3">
              <Sparkline
                data={dailyData}
                dataKey="subscribersGained"
                color="#10b981"
                width={200}
                height={32}
              />
            </div>
          </CardContent>
        </Card>

        {/* Views */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">Views</p>
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold mt-1 tracking-tight">
              {formatNumber(viewsInPeriod)}
            </p>
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                {rangeLabel}
              </span>
            </div>
            <div className="mt-3">
              <Sparkline
                data={dailyData}
                dataKey="views"
                color="#3b82f6"
                width={200}
                height={32}
              />
            </div>
          </CardContent>
        </Card>

        {/* Watch Time */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">
                Watch time (hours)
              </p>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold mt-1 tracking-tight">
              {formatNumber(watchTimeHours)}
            </p>
            <div className="mt-2">
              {avgViewDuration && (
                <span className="text-xs text-muted-foreground">
                  Avg: {formatDuration(avgViewDuration)} per view
                </span>
              )}
            </div>
            <div className="mt-3">
              <Sparkline
                data={dailyData}
                dataKey="watchTimeHours"
                color="#8b5cf6"
                width={200}
                height={32}
              />
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-medium">
                Estimated revenue
              </p>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-bold mt-1 tracking-tight">
              {formatRevenue(estimatedRevenue)}
            </p>
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">
                {estimatedRevenue != null ? rangeLabel : "Channel not monetized"}
              </span>
            </div>
            {estimatedRevenue != null && dailyData.some((d: DailyMetric) => d.estimatedRevenue) && (
              <div className="mt-3">
                <Sparkline
                  data={dailyData}
                  dataKey="estimatedRevenue"
                  color="#f59e0b"
                  width={200}
                  height={32}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Engagement Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Likes</span>
            </div>
            <p className="text-xl font-bold mt-1">{formatNumber(totalLikes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Comments</span>
            </div>
            <p className="text-xl font-bold mt-1">{formatNumber(totalComments)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Subs gained</span>
            </div>
            <p className="text-xl font-bold mt-1">
              +{formatNumber(subscriberChange > 0 ? subscriberChange : 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Avg duration</span>
            </div>
            <p className="text-xl font-bold mt-1">
              {avgViewDuration ? formatDuration(avgViewDuration) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Views Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Views</CardTitle>
          <CardDescription>{rangeLabel}</CardDescription>
        </CardHeader>
        <CardContent>
          <DailyBarChart data={dailyData} dataKey="views" color="#3b82f6" />
        </CardContent>
      </Card>

      {/* Audience Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Geography Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" />
              Geography
            </CardTitle>
            <CardDescription>Views by country</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {distribution?.geography && distribution.geography.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distribution.geography}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="country"
                    type="category"
                    width={80}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                    contentStyle={{
                      backgroundColor: "rgba(24, 24, 27, 0.95)",
                      borderRadius: "8px",
                      border: "none",
                      color: "#fff",
                    }}
                  />
                  <Bar
                    dataKey="views"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                No geography data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Device Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="w-4 h-4 text-purple-500" />
              Devices
            </CardTitle>
            <CardDescription>Views by device type</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {distribution?.device && distribution.device.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution.device}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="views"
                    nameKey="device"
                  >
                    {distribution.device.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "rgba(24, 24, 27, 0.95)",
                      borderRadius: "8px",
                      border: "none",
                      color: "#fff",
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value) => <span className="text-xs capitalize">{value.toLowerCase()}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm italic">
                No device data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Videos */}
      {topVideos && topVideos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Videos</CardTitle>
            <CardDescription>Sorted by views</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topVideos.map((video: any, i: number) => (
                <div
                  key={video.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Rank */}
                  <span className="text-sm text-muted-foreground font-mono w-6 text-right">
                    {i + 1}
                  </span>

                  {/* Thumbnail */}
                  <div className="relative w-24 h-14 rounded overflow-hidden flex-shrink-0 bg-muted">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Play className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    {video.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 rounded">
                        {formatDuration(video.duration)}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{video.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(video.publishedAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium">
                      {formatNumber(video.views)} views
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        {formatNumber(video.likes)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {formatNumber(video.comments)}
                      </span>
                    </div>
                  </div>

                  {/* External link */}
                  <a
                    href={`https://youtube.com/watch?v=${video.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync status badge */}
      {syncStatus === "FAILED" && (
        <div className="text-center">
          <Badge variant="destructive">
            Last sync failed — click Refresh to retry
          </Badge>
        </div>
      )}
    </div>
  );
}