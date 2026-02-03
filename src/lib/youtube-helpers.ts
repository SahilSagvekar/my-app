import { google } from "googleapis";

/**
 * YouTube Helper Functions
 * 
 * Utility functions to help with YouTube API operations
 */

/**
 * Get Channel ID from Channel Handle/Username
 * @param accessToken - User's OAuth access token
 * @param handle - Channel handle (e.g., "@channelname" or "channelname")
 * @returns Channel ID
 */
export async function getChannelIdFromHandle(
    accessToken: string,
    handle: string
): Promise<string | null> {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_YOUTUBE_CLIENT_ID,
            process.env.GOOGLE_YOUTUBE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: accessToken,
        });

        const youtube = google.youtube({
            version: "v3",
            auth: oauth2Client,
        });

        // Remove @ if present
        const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;

        // Search for the channel by handle
        const response = await youtube.search.list({
            part: ["snippet"],
            q: cleanHandle,
            type: ["channel"],
            maxResults: 1,
        });

        const channelId = response.data.items?.[0]?.snippet?.channelId;

        if (!channelId) {
            throw new Error(`Channel not found for handle: ${handle}`);
        }

        return channelId;
    } catch (error: any) {
        console.error("❌ Error getting channel ID from handle:", error.message);
        throw new Error(`Failed to get channel ID: ${error.message}`);
    }
}

/**
 * Get Channel ID from Channel URL
 * @param url - YouTube channel URL
 * @returns Channel ID or null if not found
 */
export function extractChannelIdFromUrl(url: string): string | null {
    try {
        // Pattern 1: /channel/CHANNEL_ID
        const channelMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
        if (channelMatch) {
            return channelMatch[1];
        }

        // Pattern 2: /c/USERNAME or /@HANDLE (need to use API to get ID)
        const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
        if (handleMatch) {
            return null; // Need to use getChannelIdFromHandle() for this
        }

        const usernameMatch = url.match(/youtube\.com\/c\/([a-zA-Z0-9_-]+)/);
        if (usernameMatch) {
            return null; // Need to use getChannelIdFromHandle() for this
        }

        return null;
    } catch (error) {
        console.error("Error extracting channel ID from URL:", error);
        return null;
    }
}

/**
 * Get Your Own Channel ID
 * @param accessToken - User's OAuth access token
 * @returns Your channel ID
 */
export async function getMyChannelId(accessToken: string): Promise<string | null> {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_YOUTUBE_CLIENT_ID,
            process.env.GOOGLE_YOUTUBE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: accessToken,
        });

        const youtube = google.youtube({
            version: "v3",
            auth: oauth2Client,
        });

        const response = await youtube.channels.list({
            part: ["id"],
            mine: true,
        });

        const channelId = response.data.items?.[0]?.id;

        if (!channelId) {
            throw new Error("No channel found for this account");
        }

        return channelId;
    } catch (error: any) {
        console.error("❌ Error getting your channel ID:", error.message);
        throw new Error(`Failed to get your channel ID: ${error.message}`);
    }
}

/**
 * Validate if a string is a valid YouTube Channel ID
 * @param channelId - Potential channel ID
 * @returns true if valid format
 */
export function isValidChannelId(channelId: string): boolean {
    // YouTube Channel IDs typically start with "UC" and are 24 characters long
    return /^UC[a-zA-Z0-9_-]{22}$/.test(channelId);
}

/**
 * Get Channel Info by Handle, URL, or ID
 * @param accessToken - User's OAuth access token
 * @param identifier - Channel handle, URL, or ID
 * @returns Channel information
 */
export async function getChannelByIdentifier(
    accessToken: string,
    identifier: string
) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_YOUTUBE_CLIENT_ID,
            process.env.GOOGLE_YOUTUBE_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            access_token: accessToken,
        });

        const youtube = google.youtube({
            version: "v3",
            auth: oauth2Client,
        });

        let channelId: string | null = null;

        // Check if it's already a valid channel ID
        if (isValidChannelId(identifier)) {
            channelId = identifier;
        }
        // Check if it's a URL
        else if (identifier.includes("youtube.com")) {
            channelId = extractChannelIdFromUrl(identifier);

            // If URL has handle/username, get ID from API
            if (!channelId) {
                const handleMatch = identifier.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/);
                if (handleMatch) {
                    channelId = await getChannelIdFromHandle(accessToken, handleMatch[1]);
                }
            }
        }
        // Assume it's a handle
        else {
            channelId = await getChannelIdFromHandle(accessToken, identifier);
        }

        if (!channelId) {
            throw new Error("Could not determine channel ID from identifier");
        }

        // Get channel info
        const response = await youtube.channels.list({
            part: ["snippet", "statistics", "contentDetails"],
            id: [channelId],
        });

        return response.data.items?.[0] || null;
    } catch (error: any) {
        console.error("❌ Error getting channel by identifier:", error.message);
        throw new Error(`Failed to get channel: ${error.message}`);
    }
}
