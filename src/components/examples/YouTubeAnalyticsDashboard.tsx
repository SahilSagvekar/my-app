"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Youtube, TrendingUp, Eye, ThumbsUp, MessageSquare } from "lucide-react";

/**
 * YouTube Analytics Dashboard Component
 * 
 * This is an example component showing how to fetch and display YouTube data.
 * 
 * Usage:
 * 1. User must be authenticated with Google OAuth (with YouTube scopes)
 * 2. Pass the access token to this component
 * 3. Component will fetch and display YouTube channel data
 */

interface YouTubeAnalyticsDashboardProps {
    accessToken: string; // User's OAuth access token
}

interface ChannelStats {
    subscriberCount: string;
    viewCount: string;
    videoCount: string;
}

interface Video {
    id: string;
    title: string;
    thumbnail: string;
    publishedAt: string;
    views?: string;
    likes?: string;
    comments?: string;
}

export default function YouTubeAnalyticsDashboard({
    accessToken
}: YouTubeAnalyticsDashboardProps) {
    const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
    const [recentVideos, setRecentVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Video[]>([]);

    // Fetch channel statistics
    useEffect(() => {
        fetchChannelStats();
        fetchRecentVideos();
    }, [accessToken]);

    const fetchChannelStats = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/youtube?action=channelInfo', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch channel stats');
            }

            const { data } = await response.json();

            setChannelStats({
                subscriberCount: data.statistics.subscriberCount,
                viewCount: data.statistics.viewCount,
                videoCount: data.statistics.videoCount,
            });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecentVideos = async () => {
        try {
            const response = await fetch('/api/youtube?action=channelVideos&maxResults=6', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error('Failed to fetch videos');
            }

            const { data } = await response.json();

            // Fetch stats for each video
            const videosWithStats = await Promise.all(
                data.slice(0, 6).map(async (item: any) => {
                    const videoId = item.snippet.resourceId.videoId;

                    // Fetch video statistics
                    const statsResponse = await fetch(
                        `/api/youtube?action=videoStats&videoId=${videoId}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                            },
                        }
                    );

                    const { data: stats } = await statsResponse.json();

                    return {
                        id: videoId,
                        title: item.snippet.title,
                        thumbnail: item.snippet.thumbnails.medium.url,
                        publishedAt: item.snippet.publishedAt,
                        views: stats.viewCount,
                        likes: stats.likeCount,
                        comments: stats.commentCount,
                    };
                })
            );

            setRecentVideos(videosWithStats);
        } catch (err: any) {
            console.error('Error fetching videos:', err);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        try {
            const response = await fetch(
                `/api/youtube?action=search&query=${encodeURIComponent(searchQuery)}&maxResults=10`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const { data } = await response.json();

            const results = data.map((item: any) => ({
                id: item.id.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.medium.url,
                publishedAt: item.snippet.publishedAt,
            }));

            setSearchResults(results);
        } catch (err: any) {
            console.error('Search error:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <Youtube className="w-16 h-16 mx-auto mb-4 animate-pulse text-red-600" />
                    <p className="text-lg">Loading YouTube data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-red-600">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{error}</p>
                        <Button onClick={fetchChannelStats} className="mt-4">
                            Retry
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Youtube className="w-10 h-10 text-red-600" />
                <h1 className="text-3xl font-bold">YouTube Analytics Dashboard</h1>
            </div>

            {/* Channel Statistics */}
            {channelStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Subscribers</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {parseInt(channelStats.subscriberCount).toLocaleString()}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {parseInt(channelStats.viewCount).toLocaleString()}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
                            <Youtube className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {parseInt(channelStats.videoCount).toLocaleString()}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Search */}
            <Card>
                <CardHeader>
                    <CardTitle>Search Videos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search for videos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch}>Search</Button>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {searchResults.map((video) => (
                                <div key={video.id} className="flex gap-3 p-3 border rounded-lg hover:bg-gray-50">
                                    <img
                                        src={video.thumbnail}
                                        alt={video.title}
                                        className="w-32 h-20 object-cover rounded"
                                    />
                                    <div className="flex-1">
                                        <h3 className="font-medium line-clamp-2">{video.title}</h3>
                                        <p className="text-sm text-gray-500">
                                            {new Date(video.publishedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Videos */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Videos</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentVideos.map((video) => (
                            <div key={video.id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                                <img
                                    src={video.thumbnail}
                                    alt={video.title}
                                    className="w-full h-48 object-cover"
                                />
                                <div className="p-4">
                                    <h3 className="font-semibold line-clamp-2 mb-2">{video.title}</h3>
                                    <p className="text-sm text-gray-500 mb-3">
                                        {new Date(video.publishedAt).toLocaleDateString()}
                                    </p>

                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Eye className="w-4 h-4" />
                                            <span>{parseInt(video.views || '0').toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <ThumbsUp className="w-4 h-4" />
                                            <span>{parseInt(video.likes || '0').toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <MessageSquare className="w-4 h-4" />
                                            <span>{parseInt(video.comments || '0').toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <Button
                                        variant="outline"
                                        className="w-full mt-3"
                                        onClick={() => window.open(`https://youtube.com/watch?v=${video.id}`, '_blank')}
                                    >
                                        Watch on YouTube
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
