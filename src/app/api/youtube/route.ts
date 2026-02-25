export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import {
    getChannelInfo,
    getChannelVideos,
    getVideoDetails,
    getVideoStatistics,
    searchVideos,
    getVideoComments,
    getMyPlaylists,
    getChannelAnalytics,
} from "@/lib/youtubeService";
import {
    getMyChannelId,
    getChannelIdFromHandle,
    getChannelByIdentifier,
} from "@/lib/youtube-helpers";

/**
 * YouTube API Route
 * 
 * This endpoint provides various YouTube data fetching capabilities.
 * 
 * Usage Examples:
 * 
 * 1. Get Channel Info:
 *    GET /api/youtube?action=channelInfo&channelId=UC_x5XG1OV2P6uZZ5FSM9Ttw
 * 
 * 2. Get Channel Videos:
 *    GET /api/youtube?action=channelVideos&maxResults=10
 * 
 * 3. Get Video Details:
 *    GET /api/youtube?action=videoDetails&videoId=dQw4w9WgXcQ
 * 
 * 4. Get Video Statistics:
 *    GET /api/youtube?action=videoStats&videoId=dQw4w9WgXcQ
 * 
 * 5. Search Videos:
 *    GET /api/youtube?action=search&query=coding+tutorial&maxResults=10
 * 
 * 6. Get Video Comments:
 *    GET /api/youtube?action=comments&videoId=dQw4w9WgXcQ&maxResults=20
 * 
 * 7. Get My Playlists:
 *    GET /api/youtube?action=playlists&maxResults=25
 * 
 * 8. Get Channel Analytics:
 *    GET /api/youtube?action=analytics&channelId=UC_xxx&startDate=2024-01-01&endDate=2024-12-31
 */

export async function GET(request: NextRequest) {
    try {
        // Get the access token from the request headers or cookies
        const accessToken = request.headers.get("Authorization")?.replace("Bearer ", "");

        if (!accessToken) {
            return NextResponse.json(
                { error: "Access token is required. Please authenticate first." },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");

        switch (action) {
            case "channelInfo": {
                const channelId = searchParams.get("channelId") || undefined;
                const data = await getChannelInfo(accessToken, channelId);
                return NextResponse.json({ success: true, data });
            }

            case "channelVideos": {
                const channelId = searchParams.get("channelId") || undefined;
                const maxResults = parseInt(searchParams.get("maxResults") || "25");
                const data = await getChannelVideos(accessToken, channelId, maxResults);
                return NextResponse.json({ success: true, data });
            }

            case "videoDetails": {
                const videoId = searchParams.get("videoId");
                if (!videoId) {
                    return NextResponse.json(
                        { error: "videoId is required" },
                        { status: 400 }
                    );
                }
                const data = await getVideoDetails(accessToken, videoId);
                return NextResponse.json({ success: true, data });
            }

            case "videoStats": {
                const videoId = searchParams.get("videoId");
                if (!videoId) {
                    return NextResponse.json(
                        { error: "videoId is required" },
                        { status: 400 }
                    );
                }
                const data = await getVideoStatistics(accessToken, videoId);
                return NextResponse.json({ success: true, data });
            }

            case "search": {
                const query = searchParams.get("query");
                if (!query) {
                    return NextResponse.json(
                        { error: "query is required" },
                        { status: 400 }
                    );
                }
                const maxResults = parseInt(searchParams.get("maxResults") || "10");
                const data = await searchVideos(accessToken, query, maxResults);
                return NextResponse.json({ success: true, data });
            }

            case "comments": {
                const videoId = searchParams.get("videoId");
                if (!videoId) {
                    return NextResponse.json(
                        { error: "videoId is required" },
                        { status: 400 }
                    );
                }
                const maxResults = parseInt(searchParams.get("maxResults") || "20");
                const data = await getVideoComments(accessToken, videoId, maxResults);
                return NextResponse.json({ success: true, data });
            }

            case "playlists": {
                const maxResults = parseInt(searchParams.get("maxResults") || "25");
                const data = await getMyPlaylists(accessToken, maxResults);
                return NextResponse.json({ success: true, data });
            }

            case "analytics": {
                const channelId = searchParams.get("channelId");
                const startDate = searchParams.get("startDate");
                const endDate = searchParams.get("endDate");

                if (!channelId || !startDate || !endDate) {
                    return NextResponse.json(
                        { error: "channelId, startDate, and endDate are required" },
                        { status: 400 }
                    );
                }

                const data = await getChannelAnalytics(
                    accessToken,
                    channelId,
                    startDate,
                    endDate
                );
                return NextResponse.json({ success: true, data });
            }

            case "getMyChannelId": {
                const data = await getMyChannelId(accessToken);
                return NextResponse.json({ success: true, channelId: data });
            }

            case "getChannelIdFromHandle": {
                const handle = searchParams.get("handle");
                if (!handle) {
                    return NextResponse.json(
                        { error: "handle is required (e.g., @channelname or channelname)" },
                        { status: 400 }
                    );
                }
                const data = await getChannelIdFromHandle(accessToken, handle);
                return NextResponse.json({ success: true, channelId: data });
            }

            case "getChannelByIdentifier": {
                const identifier = searchParams.get("identifier");
                if (!identifier) {
                    return NextResponse.json(
                        { error: "identifier is required (handle, URL, or channel ID)" },
                        { status: 400 }
                    );
                }
                const data = await getChannelByIdentifier(accessToken, identifier);
                return NextResponse.json({ success: true, data });
            }

            default:
                return NextResponse.json(
                    {
                        error: "Invalid action",
                        availableActions: [
                            "channelInfo",
                            "channelVideos",
                            "videoDetails",
                            "videoStats",
                            "search",
                            "comments",
                            "playlists",
                            "analytics",
                            "getMyChannelId",
                            "getChannelIdFromHandle",
                            "getChannelByIdentifier",
                        ],
                    },
                    { status: 400 }
                );
        }
    } catch (error: any) {
        console.error("❌ YouTube API Error:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch YouTube data",
                message: error.message,
            },
            { status: 500 }
        );
    }
}
