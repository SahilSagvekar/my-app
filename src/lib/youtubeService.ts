import { google } from "googleapis";

/**
 * YouTube Service - Handles all YouTube API interactions
 * 
 * This service provides methods to:
 * - Get channel information
 * - Fetch video details
 * - Retrieve video statistics
 * - Get playlists
 * - Search for videos
 * - Get comments
 */

// Initialize YouTube API client with OAuth2
export function getYouTubeClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_YOUTUBE_CLIENT_ID,
        process.env.GOOGLE_YOUTUBE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback"
    );

    // Set credentials with the user's access token
    oauth2Client.setCredentials({
        access_token: accessToken,
    });

    return google.youtube({
        version: "v3",
        auth: oauth2Client,
    });
}

// Alternative: Use API Key for public data (no OAuth required)
export function getYouTubeClientWithApiKey() {
    return google.youtube({
        version: "v3",
        auth: process.env.YOUTUBE_API_KEY, // You'll need to add this to .env
    });
}

/**
 * Get Channel Information
 * @param accessToken - User's OAuth access token
 * @param channelId - Optional channel ID (defaults to authenticated user's channel)
 */
export async function getChannelInfo(accessToken: string, channelId?: string) {
    try {
        const youtube = getYouTubeClient(accessToken);

        const response = await youtube.channels.list({
            part: ["snippet", "contentDetails", "statistics"],
            ...(channelId ? { id: [channelId] } : { mine: true }),
        });

        return response.data.items?.[0] || null;
    } catch (error: any) {
        console.error("❌ Error fetching channel info:", error.message);
        throw new Error(`Failed to fetch channel info: ${error.message}`);
    }
}

/**
 * Get Video Details
 * @param accessToken - User's OAuth access token
 * @param videoId - YouTube video ID
 */
export async function getVideoDetails(accessToken: string, videoId: string) {
    try {
        const youtube = getYouTubeClient(accessToken);

        const response = await youtube.videos.list({
            part: ["snippet", "contentDetails", "statistics", "status"],
            id: [videoId],
        });

        return response.data.items?.[0] || null;
    } catch (error: any) {
        console.error("❌ Error fetching video details:", error.message);
        throw new Error(`Failed to fetch video details: ${error.message}`);
    }
}

/**
 * Get Channel's Videos
 * @param accessToken - User's OAuth access token
 * @param channelId - Optional channel ID (defaults to authenticated user's channel)
 * @param maxResults - Maximum number of results (default: 25, max: 50)
 */
export async function getChannelVideos(
    accessToken: string,
    channelId?: string,
    maxResults: number = 25
) {
    try {
        const youtube = getYouTubeClient(accessToken);

        // First, get the channel's uploads playlist ID
        const channelResponse = await youtube.channels.list({
            part: ["contentDetails"],
            ...(channelId ? { id: [channelId] } : { mine: true }),
        });

        const uploadsPlaylistId =
            channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

        if (!uploadsPlaylistId) {
            throw new Error("Could not find uploads playlist");
        }

        // Get videos from the uploads playlist
        const playlistResponse = await youtube.playlistItems.list({
            part: ["snippet", "contentDetails"],
            playlistId: uploadsPlaylistId,
            maxResults,
        });

        return playlistResponse.data.items || [];
    } catch (error: any) {
        console.error("❌ Error fetching channel videos:", error.message);
        throw new Error(`Failed to fetch channel videos: ${error.message}`);
    }
}

/**
 * Get Video Analytics/Statistics
 * @param accessToken - User's OAuth access token
 * @param videoId - YouTube video ID
 */
export async function getVideoStatistics(accessToken: string, videoId: string) {
    try {
        const youtube = getYouTubeClient(accessToken);

        const response = await youtube.videos.list({
            part: ["statistics"],
            id: [videoId],
        });

        const stats = response.data.items?.[0]?.statistics;

        return {
            viewCount: stats?.viewCount || "0",
            likeCount: stats?.likeCount || "0",
            commentCount: stats?.commentCount || "0",
            favoriteCount: stats?.favoriteCount || "0",
        };
    } catch (error: any) {
        console.error("❌ Error fetching video statistics:", error.message);
        throw new Error(`Failed to fetch video statistics: ${error.message}`);
    }
}

/**
 * Search for Videos
 * @param accessToken - User's OAuth access token
 * @param query - Search query
 * @param maxResults - Maximum number of results (default: 10, max: 50)
 */
export async function searchVideos(
    accessToken: string,
    query: string,
    maxResults: number = 10
) {
    try {
        const youtube = getYouTubeClient(accessToken);

        const response = await youtube.search.list({
            part: ["snippet"],
            q: query,
            type: ["video"],
            maxResults,
        });

        return response.data.items || [];
    } catch (error: any) {
        console.error("❌ Error searching videos:", error.message);
        throw new Error(`Failed to search videos: ${error.message}`);
    }
}

/**
 * Get Video Comments
 * @param accessToken - User's OAuth access token
 * @param videoId - YouTube video ID
 * @param maxResults - Maximum number of results (default: 20, max: 100)
 */
export async function getVideoComments(
    accessToken: string,
    videoId: string,
    maxResults: number = 20
) {
    try {
        const youtube = getYouTubeClient(accessToken);

        const response = await youtube.commentThreads.list({
            part: ["snippet"],
            videoId,
            maxResults,
            order: "relevance",
        });

        return response.data.items || [];
    } catch (error: any) {
        console.error("❌ Error fetching video comments:", error.message);
        throw new Error(`Failed to fetch video comments: ${error.message}`);
    }
}

/**
 * Get Channel Analytics (requires YouTube Analytics API)
 * @param accessToken - User's OAuth access token
 * @param channelId - Channel ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 */
export async function getChannelAnalytics(
    accessToken: string,
    channelId: string,
    startDate: string,
    endDate: string
) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_YOUTUBE_CLIENT_ID,
            process.env.GOOGLE_YOUTUBE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: accessToken,
        });

        const youtubeAnalytics = google.youtubeAnalytics({
            version: "v2",
            auth: oauth2Client,
        });

        const response = await youtubeAnalytics.reports.query({
            ids: `channel==${channelId}`,
            startDate,
            endDate,
            metrics: "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost",
            dimensions: "day",
        });

        return response.data;
    } catch (error: any) {
        console.error("❌ Error fetching channel analytics:", error.message);
        throw new Error(`Failed to fetch channel analytics: ${error.message}`);
    }
}

/**
 * Get My Playlists
 * @param accessToken - User's OAuth access token
 * @param maxResults - Maximum number of results (default: 25, max: 50)
 */
export async function getMyPlaylists(
    accessToken: string,
    maxResults: number = 25
) {
    try {
        const youtube = getYouTubeClient(accessToken);

        const response = await youtube.playlists.list({
            part: ["snippet", "contentDetails"],
            mine: true,
            maxResults,
        });

        return response.data.items || [];
    } catch (error: any) {
        console.error("❌ Error fetching playlists:", error.message);
        throw new Error(`Failed to fetch playlists: ${error.message}`);
    }
}
