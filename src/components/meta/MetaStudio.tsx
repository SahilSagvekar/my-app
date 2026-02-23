// src/components/meta/MetaStudio.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useMetaAnalytics } from "@/lib/hooks/useMetaAnalytics";
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
    Instagram,
    RefreshCw,
    Eye,
    Users,
    Heart,
    MessageCircle,
    Bookmark,
    TrendingUp,
    ExternalLink,
    Globe,
    Smartphone,
    PieChart as PieChartIcon,
    Share2,
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

const CHART_COLORS = ["#E1306C", "#C13584", "#833AB4", "#5851DB", "#405DE6", "#FD1D1D"];

export function formatNumber(num: number): string {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
    return num.toLocaleString();
}

export function formatRevenue(amount: number | null): string {
    if (amount == null) return "—";
    return "₹" + amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MetaStudio({ clientId }: { clientId: string }) {
    const { data, loading, syncing, error, range, setRange, triggerSync } = useMetaAnalytics(clientId);

    useEffect(() => {
        const url = new URL(window.location.href);
        if (url.searchParams.get("connected") === "true") {
            toast.success("Instagram account connected successfully!");
            url.searchParams.delete("connected");
            window.history.replaceState({}, "", url.pathname + url.search);
        }
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-10 w-1/3 bg-muted rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-32 bg-muted rounded" />
                    ))}
                </div>
                <div className="h-64 bg-muted rounded" />
            </div>
        );
    }

    if (!data?.connected) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                        <Instagram className="w-8 h-8 text-pink-600" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold">Connect Instagram Business</h3>
                        <p className="text-muted-foreground text-sm mt-1 max-w-md">
                            Connect your Instagram Business or Creator account to see professional insights and audience demographics.
                        </p>
                    </div>
                    <Button
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                        onClick={() => {
                            window.location.href = `/api/meta/connect?clientId=${clientId}`;
                        }}
                    >
                        <Instagram className="w-4 h-4 mr-2" />
                        Connect Instagram
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const {
        username,
        profilePicture,
        followerCount,
        followersGained,
        impressions,
        reach,
        engagementRate,
        topPosts,
        demographics,
        lastSyncedAt,
        syncStatus,
    } = data;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {profilePicture && (
                        <img src={profilePicture} alt={username} className="w-12 h-12 rounded-full border-2 border-pink-500 p-0.5" />
                    )}
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            @{username}
                            <Instagram className="w-5 h-5 text-pink-600" />
                        </h2>
                        {lastSyncedAt && (
                            <p className="text-xs text-muted-foreground">
                                Last synced: {new Date(lastSyncedAt).toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={range} onValueChange={setRange}>
                        <SelectTrigger className="w-[160px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                            <SelectItem value="28d">Last 28 days</SelectItem>
                            <SelectItem value="90d">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" size="sm" onClick={triggerSync} disabled={syncing}>
                        <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Syncing..." : "Refresh"}
                    </Button>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <Users className="w-4 h-4" /> Total Followers
                        </CardDescription>
                        <CardTitle className="text-2xl">{formatNumber(followerCount)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-emerald-500 font-medium">
                            +{formatNumber(followersGained)} in period
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <Eye className="w-4 h-4" /> Impressions
                        </CardDescription>
                        <CardTitle className="text-2xl">{formatNumber(impressions)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">Total times posts were seen</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <Share2 className="w-4 h-4" /> Reach
                        </CardDescription>
                        <CardTitle className="text-2xl">{formatNumber(reach)}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">Unique accounts reached</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Engagement Rate
                        </CardDescription>
                        <CardTitle className="text-2xl">{engagementRate}%</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xs text-muted-foreground">Based on followers</div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Demographics - Age & Gender */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Users className="w-4 h-4 text-purple-500" /> Audience Age & Gender
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {demographics?.audience_gender_age ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={Object.entries(demographics.audience_gender_age.values[0].value).map(([key, val]) => ({
                                    name: key.replace('M.', 'Men ').replace('F.', 'Women '),
                                    value: val as number
                                }))}>
                                    <XAxis dataKey="name" fontSize={10} angle={-45} textAnchor="end" height={60} />
                                    <YAxis hide />
                                    <RechartsTooltip />
                                    <Bar dataKey="value" fill="#E1306C" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground italic text-sm">No demographic data</div>
                        )}
                    </CardContent>
                </Card>

                {/* Location - Top Countries */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-500" /> Top Countries
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        {demographics?.audience_country ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={Object.entries(demographics.audience_country.values[0].value)
                                            .map(([key, val]) => ({ name: key, value: val as number }))
                                            .sort((a, b) => b.value - a.value)
                                            .slice(0, 5)}
                                        cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                                    >
                                        {[1, 2, 3, 4, 5].map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground italic text-sm">No location data</div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Top Posts */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Recent Posts Performance</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {topPosts.slice(0, 6).map((post: any) => (
                            <div key={post.id} className="border rounded-lg overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div className="aspect-square relative flex items-center justify-center bg-zinc-900">
                                    <img src={post.media_url || post.thumbnail_url} alt="" className="w-full h-full object-cover opacity-80" />
                                    <div className="absolute top-2 right-2">
                                        <Badge variant="secondary" className="bg-black/60 text-white text-[10px] border-none">
                                            {post.media_type}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="p-3 space-y-2">
                                    <p className="text-xs line-clamp-2 min-h-[2.5rem] italic font-serif">
                                        {post.caption || "No caption"}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex gap-3">
                                            <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-500" /> {formatNumber(post.like_count)}</span>
                                            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-blue-500" /> {formatNumber(post.comments_count)}</span>
                                            {post.insights?.saved !== undefined && (
                                                <span className="flex items-center gap-1"><Bookmark className="w-3.5 h-3.5 text-yellow-500" /> {formatNumber(post.insights.saved)}</span>
                                            )}
                                        </div>
                                    </div>
                                    {post.insights?.reach !== undefined && (
                                        <div className="pt-2 border-t flex justify-between text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                                            <span>Reach: {formatNumber(post.insights.reach)}</span>
                                            {post.insights.impressions && <span>Impressions: {formatNumber(post.insights.impressions)}</span>}
                                        </div>
                                    )}
                                    <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-[10px] text-pink-600 font-bold hover:underline mt-2">
                                        View on Instagram <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {syncStatus === "FAILED" && (
                <div className="text-center">
                    <Badge variant="destructive">Sync failed — tokens may have expired. Please reconnect.</Badge>
                </div>
            )}
        </div>
    );
}
