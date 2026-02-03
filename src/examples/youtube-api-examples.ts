/**
 * QUICK START: YouTube API Examples
 * 
 * Copy and paste these examples to quickly get YouTube data
 */

// ============================================
// EXAMPLE 1: Get Your Channel Info
// ============================================
async function getMyChannelInfo(accessToken: string) {
    const response = await fetch('/api/youtube?action=channelInfo', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    const { data } = await response.json();

    console.log('Channel Name:', data.snippet.title);
    console.log('Subscribers:', data.statistics.subscriberCount);
    console.log('Total Views:', data.statistics.viewCount);
    console.log('Total Videos:', data.statistics.videoCount);

    return data;
}

// ============================================
// EXAMPLE 2: Get Your Latest 10 Videos
// ============================================
async function getMyLatestVideos(accessToken: string) {
    const response = await fetch('/api/youtube?action=channelVideos&maxResults=10', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    const { data } = await response.json();

    const videos = data.map((item: any) => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.high.url,
        publishedAt: item.snippet.publishedAt,
    }));

    console.log('Latest Videos:', videos);
    return videos;
}

// ============================================
// EXAMPLE 3: Get Video Performance Stats
// ============================================
async function getVideoStats(accessToken: string, videoId: string) {
    const response = await fetch(`/api/youtube?action=videoStats&videoId=${videoId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    const { data } = await response.json();

    console.log('Views:', data.viewCount);
    console.log('Likes:', data.likeCount);
    console.log('Comments:', data.commentCount);

    return data;
}

// ============================================
// EXAMPLE 4: Search YouTube Videos
// ============================================
async function searchYouTubeVideos(accessToken: string, searchTerm: string) {
    const response = await fetch(
        `/api/youtube?action=search&query=${encodeURIComponent(searchTerm)}&maxResults=10`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        }
    );

    const { data } = await response.json();

    const results = data.map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium.url,
    }));

    console.log('Search Results:', results);
    return results;
}

// ============================================
// EXAMPLE 5: Get Video Comments
// ============================================
async function getVideoComments(accessToken: string, videoId: string) {
    const response = await fetch(
        `/api/youtube?action=comments&videoId=${videoId}&maxResults=20`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        }
    );

    const { data } = await response.json();

    const comments = data.map((item: any) => ({
        author: item.snippet.topLevelComment.snippet.authorDisplayName,
        text: item.snippet.topLevelComment.snippet.textDisplay,
        likeCount: item.snippet.topLevelComment.snippet.likeCount,
        publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
    }));

    console.log('Comments:', comments);
    return comments;
}

// ============================================
// EXAMPLE 6: Get Complete Video Dashboard Data
// ============================================
async function getVideoDashboard(accessToken: string, videoId: string) {
    // Fetch video details and stats in parallel
    const [detailsResponse, statsResponse, commentsResponse] = await Promise.all([
        fetch(`/api/youtube?action=videoDetails&videoId=${videoId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch(`/api/youtube?action=videoStats&videoId=${videoId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch(`/api/youtube?action=comments&videoId=${videoId}&maxResults=5`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
    ]);

    const details = await detailsResponse.json();
    const stats = await statsResponse.json();
    const comments = await commentsResponse.json();

    const dashboard = {
        title: details.data.snippet.title,
        description: details.data.snippet.description,
        publishedAt: details.data.snippet.publishedAt,
        thumbnail: details.data.snippet.thumbnails.high.url,
        views: stats.data.viewCount,
        likes: stats.data.likeCount,
        commentCount: stats.data.commentCount,
        topComments: comments.data.slice(0, 5).map((item: any) => ({
            author: item.snippet.topLevelComment.snippet.authorDisplayName,
            text: item.snippet.topLevelComment.snippet.textDisplay,
        })),
    };

    console.log('Video Dashboard:', dashboard);
    return dashboard;
}

// ============================================
// EXAMPLE 7: Get Channel Analytics (Last 30 Days)
// ============================================
async function getChannelAnalytics30Days(accessToken: string, channelId: string) {
    const endDate = new Date().toISOString().split('T')[0]; // Today
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]; // 30 days ago

    const response = await fetch(
        `/api/youtube?action=analytics&channelId=${channelId}&startDate=${startDate}&endDate=${endDate}`,
        {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        }
    );

    const { data } = await response.json();

    console.log('Analytics (Last 30 Days):', data);
    return data;
}

// ============================================
// EXAMPLE 8: Get All Playlists
// ============================================
async function getMyPlaylists(accessToken: string) {
    const response = await fetch('/api/youtube?action=playlists&maxResults=25', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    const { data } = await response.json();

    const playlists = data.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        videoCount: item.contentDetails.itemCount,
        thumbnail: item.snippet.thumbnails.medium.url,
    }));

    console.log('Playlists:', playlists);
    return playlists;
}

// ============================================
// EXAMPLE 9: React Hook for YouTube Data
// ============================================
import { useState, useEffect } from 'react';

function useYouTubeChannelStats(accessToken: string) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchStats() {
            try {
                setLoading(true);
                const response = await fetch('/api/youtube?action=channelInfo', {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });

                const { data } = await response.json();
                setStats(data.statistics);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        if (accessToken) {
            fetchStats();
        }
    }, [accessToken]);

    return { stats, loading, error };
}

// Usage in component:
// const { stats, loading, error } = useYouTubeChannelStats(accessToken);

// ============================================
// EXAMPLE 10: Batch Get Multiple Video Stats
// ============================================
async function getBatchVideoStats(accessToken: string, videoIds: string[]) {
    const statsPromises = videoIds.map(videoId =>
        fetch(`/api/youtube?action=videoStats&videoId=${videoId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
        }).then(r => r.json())
    );

    const results = await Promise.all(statsPromises);

    const batchStats = results.map((result, index) => ({
        videoId: videoIds[index],
        ...result.data,
    }));

    console.log('Batch Video Stats:', batchStats);
    return batchStats;
}

// ============================================
// HOW TO USE THESE EXAMPLES
// ============================================

/*

1. Make sure you have a valid access token from Google OAuth
2. Copy any of the functions above
3. Call them with your access token

Example usage in a React component:

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function MyYouTubePage() {
  const [channelInfo, setChannelInfo] = useState(null);
  const accessToken = 'YOUR_ACCESS_TOKEN_HERE'; // Get this from your auth system

  useEffect(() => {
    async function loadData() {
      // Use any of the examples above
      const info = await getMyChannelInfo(accessToken);
      setChannelInfo(info);
      
      const videos = await getMyLatestVideos(accessToken);
      console.log('My videos:', videos);
    }
    
    loadData();
  }, []);

  return (
    <div>
      {channelInfo && (
        <div>
          <h1>{channelInfo.snippet.title}</h1>
          <p>Subscribers: {channelInfo.statistics.subscriberCount}</p>
        </div>
      )}
    </div>
  );
}
```

*/

export {
    getMyChannelInfo,
    getMyLatestVideos,
    getVideoStats,
    searchYouTubeVideos,
    getVideoComments,
    getVideoDashboard,
    getChannelAnalytics30Days,
    getMyPlaylists,
    useYouTubeChannelStats,
    getBatchVideoStats,
};
