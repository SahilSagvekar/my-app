# YouTube API Integration Guide

## 📋 Overview

This guide explains how to GET data from the YouTube API in your E8 Productions project.

## 🔑 Prerequisites

### 1. YouTube API Credentials (Already Set Up ✅)

Your `.env` file already has:
```env
GOOGLE_YOUTUBE_CLIENT_ID=943191497448-ugcm36tgo3et0tsv6lghi1h5iptvmssv.apps.googleusercontent.com
GOOGLE_YOUTUBE_CLIENT_SECRET=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
```

### 2. Enable YouTube Data API v3

You need to enable the YouTube Data API v3 in your Google Cloud Console:

1. Go to: https://console.cloud.google.com/
2. Select your project
3. Navigate to "APIs & Services" > "Library"
4. Search for "YouTube Data API v3"
5. Click "Enable"

### 3. (Optional) Add YouTube API Key for Public Data

If you want to fetch public data without OAuth, add this to your `.env`:
```env
YOUTUBE_API_KEY=your_api_key_here
```

## 🚀 How to Use

### Method 1: Using the API Route (Recommended)

#### Example 1: Get Channel Information

```typescript
// Frontend code
const response = await fetch('/api/youtube?action=channelInfo', {
  headers: {
    'Authorization': `Bearer ${accessToken}`, // User's OAuth token
  },
});

const data = await response.json();
console.log(data);
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
    "snippet": {
      "title": "Channel Name",
      "description": "Channel description",
      "customUrl": "@channelname",
      "publishedAt": "2015-01-01T00:00:00Z",
      "thumbnails": { ... }
    },
    "statistics": {
      "viewCount": "1000000",
      "subscriberCount": "50000",
      "videoCount": "250"
    }
  }
}
```

#### Example 2: Get Channel Videos

```typescript
const response = await fetch('/api/youtube?action=channelVideos&maxResults=10', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});

const data = await response.json();
console.log(data.data); // Array of videos
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "snippet": {
        "title": "Video Title",
        "description": "Video description",
        "publishedAt": "2024-01-15T10:00:00Z",
        "thumbnails": { ... },
        "resourceId": {
          "videoId": "dQw4w9WgXcQ"
        }
      }
    }
  ]
}
```

#### Example 3: Get Video Statistics

```typescript
const videoId = 'dQw4w9WgXcQ';
const response = await fetch(`/api/youtube?action=videoStats&videoId=${videoId}`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});

const data = await response.json();
console.log(data.data);
```

**Response:**
```json
{
  "success": true,
  "data": {
    "viewCount": "1234567",
    "likeCount": "45678",
    "commentCount": "1234",
    "favoriteCount": "0"
  }
}
```

#### Example 4: Search for Videos

```typescript
const query = 'coding tutorial';
const response = await fetch(
  `/api/youtube?action=search&query=${encodeURIComponent(query)}&maxResults=10`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  }
);

const data = await response.json();
console.log(data.data); // Array of search results
```

#### Example 5: Get Video Comments

```typescript
const videoId = 'dQw4w9WgXcQ';
const response = await fetch(
  `/api/youtube?action=comments&videoId=${videoId}&maxResults=20`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  }
);

const data = await response.json();
console.log(data.data); // Array of comments
```

#### Example 6: Get Channel Analytics

```typescript
const channelId = 'UC_x5XG1OV2P6uZZ5FSM9Ttw';
const startDate = '2024-01-01';
const endDate = '2024-12-31';

const response = await fetch(
  `/api/youtube?action=analytics&channelId=${channelId}&startDate=${startDate}&endDate=${endDate}`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  }
);

const data = await response.json();
console.log(data.data); // Analytics data
```

### Method 2: Direct Service Usage (Server-Side Only)

```typescript
// In your API route or server component
import { getChannelInfo, getVideoDetails } from '@/lib/youtubeService';

export async function GET(request: NextRequest) {
  const accessToken = 'user_access_token';
  
  // Get channel info
  const channelInfo = await getChannelInfo(accessToken);
  
  // Get video details
  const videoDetails = await getVideoDetails(accessToken, 'dQw4w9WgXcQ');
  
  return NextResponse.json({ channelInfo, videoDetails });
}
```

## 🔐 Getting User Access Token

To get data from YouTube API, you need a user's OAuth access token. Here's how:

### Option 1: Use Existing Google OAuth Flow

Your project already has Google OAuth. You can extend it to include YouTube scopes:

1. Update your Google OAuth scopes to include YouTube:

```typescript
// In your auth configuration
const scopes = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/youtube.readonly', // Add this
  'https://www.googleapis.com/auth/youtube.force-ssl', // Add this for full access
  'https://www.googleapis.com/auth/yt-analytics.readonly', // Add this for analytics
];
```

2. After user logs in with Google, you'll receive an access token
3. Store this token securely (in your database or session)
4. Use this token to make YouTube API calls

### Option 2: Create a Separate YouTube OAuth Flow

Create a dedicated YouTube authentication endpoint:

```typescript
// src/app/api/auth/youtube/route.ts
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_YOUTUBE_CLIENT_ID,
    process.env.GOOGLE_YOUTUBE_CLIENT_SECRET,
    'http://localhost:3000/api/auth/youtube/callback'
  );

  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  return NextResponse.redirect(url);
}
```

## 📊 Available Actions

| Action | Description | Required Params | Optional Params |
|--------|-------------|-----------------|-----------------|
| `channelInfo` | Get channel information | - | `channelId` |
| `channelVideos` | Get channel's videos | - | `channelId`, `maxResults` |
| `videoDetails` | Get video details | `videoId` | - |
| `videoStats` | Get video statistics | `videoId` | - |
| `search` | Search for videos | `query` | `maxResults` |
| `comments` | Get video comments | `videoId` | `maxResults` |
| `playlists` | Get user's playlists | - | `maxResults` |
| `analytics` | Get channel analytics | `channelId`, `startDate`, `endDate` | - |

## 🎯 Common Use Cases

### Use Case 1: Display User's YouTube Channel Stats

```typescript
async function displayChannelStats(accessToken: string) {
  const response = await fetch('/api/youtube?action=channelInfo', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  const { data } = await response.json();
  
  return {
    subscribers: data.statistics.subscriberCount,
    totalViews: data.statistics.viewCount,
    videoCount: data.statistics.videoCount,
  };
}
```

### Use Case 2: Show Recent Videos

```typescript
async function getRecentVideos(accessToken: string) {
  const response = await fetch('/api/youtube?action=channelVideos&maxResults=5', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  const { data } = await response.json();
  
  return data.map((item: any) => ({
    id: item.snippet.resourceId.videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.medium.url,
    publishedAt: item.snippet.publishedAt,
  }));
}
```

### Use Case 3: Video Performance Dashboard

```typescript
async function getVideoPerformance(accessToken: string, videoId: string) {
  const [details, stats] = await Promise.all([
    fetch(`/api/youtube?action=videoDetails&videoId=${videoId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }).then(r => r.json()),
    fetch(`/api/youtube?action=videoStats&videoId=${videoId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }).then(r => r.json()),
  ]);
  
  return {
    title: details.data.snippet.title,
    views: stats.data.viewCount,
    likes: stats.data.likeCount,
    comments: stats.data.commentCount,
  };
}
```

## ⚠️ Important Notes

1. **Rate Limits**: YouTube API has quota limits (10,000 units/day by default)
2. **OAuth Token**: Access tokens expire after 1 hour. You may need to refresh them
3. **Scopes**: Make sure to request the appropriate scopes during OAuth
4. **Error Handling**: Always handle errors gracefully (quota exceeded, invalid token, etc.)

## 🔧 Troubleshooting

### Error: "Access token is required"
- Make sure you're sending the Authorization header with a valid access token

### Error: "The request cannot be completed because you have exceeded your quota"
- You've hit the daily API quota limit
- Wait 24 hours or request a quota increase in Google Cloud Console

### Error: "Invalid Credentials"
- Check that your `GOOGLE_YOUTUBE_CLIENT_ID` and `GOOGLE_YOUTUBE_CLIENT_SECRET` are correct
- Ensure the YouTube Data API v3 is enabled in your Google Cloud project

## 📚 Additional Resources

- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [YouTube Analytics API Documentation](https://developers.google.com/youtube/analytics)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
