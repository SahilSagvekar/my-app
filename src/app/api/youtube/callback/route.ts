// src/app/api/youtube/callback/route.ts
// Handles the OAuth callback from Google

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchChannelInfo } from "@/lib/youtube";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const stateParam = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");

    // User denied access
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=denied`
      );
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=missing_params`
      );
    }

    // Decode state to get clientId
    const state = JSON.parse(
      Buffer.from(stateParam, "base64").toString("utf-8")
    );
    const { clientId } = state;

    if (!clientId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=invalid_state`
      );
    }

    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_YOUTUBE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_YOUTUBE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[YouTube Callback] Token exchange failed:", err);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=token_failed`
      );
    }

    const tokens = await tokenRes.json();

    // Get the user's channel info
    // First, get the authenticated user's channel
    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    if (!channelRes.ok) {
      console.error("[YouTube Callback] Channel fetch failed");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=channel_fetch_failed`
      );
    }

    const channelData = await channelRes.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=no_channel`
      );
    }

    // Upsert the YouTube channel record
    await prisma.youTubeChannel.upsert({
      where: { clientId },
      update: {
        channelId: channel.id,
        channelTitle: channel.snippet.title,
        channelAvatar: channel.snippet.thumbnails?.medium?.url || "",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope || "",
        subscriberCount: parseInt(
          channel.statistics.subscriberCount || "0"
        ),
        totalViews: BigInt(channel.statistics.viewCount || "0"),
        totalVideos: parseInt(channel.statistics.videoCount || "0"),
        isActive: true,
        syncStatus: "PENDING",
        syncError: null,
      },
      create: {
        clientId,
        channelId: channel.id,
        channelTitle: channel.snippet.title,
        channelAvatar: channel.snippet.thumbnails?.medium?.url || "",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
        scope: tokens.scope || "",
        subscriberCount: parseInt(
          channel.statistics.subscriberCount || "0"
        ),
        totalViews: BigInt(channel.statistics.viewCount || "0"),
        totalVideos: parseInt(channel.statistics.videoCount || "0"),
      },
    });

    // Redirect back to the studio page on success
    // Adjust this URL to match your client's studio page route
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_connected=true&clientId=${clientId}`
    );
  } catch (error: any) {
    console.error("[YouTube Callback] Error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=server_error`
    );
  }
}