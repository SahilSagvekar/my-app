// src/app/api/youtube/connect/route.ts
// Initiates the YouTube OAuth flow

import { NextRequest, NextResponse } from "next/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// Scopes needed:
// - youtube.readonly = channel info + video stats (Data API)
// - yt-analytics.readonly = watch time, revenue, impressions (Analytics API)
// - yt-analytics-monetary.readonly = revenue data specifically
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
].join(" ");

export async function GET(req: NextRequest) {
  try {
    // Get clientId from query params - this is YOUR e8 client ID
    const clientId = req.nextUrl.searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    // TODO: Add your auth check here
    // const session = await getServerSession(authOptions);
    // Verify user has permission to connect this client's YouTube

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`;

    // Pass clientId in state so we get it back in the callback
    const state = JSON.stringify({ clientId });

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_YOUTUBE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline", // Gets us a refresh_token
      prompt: "consent", // Force consent to always get refresh_token
      state: Buffer.from(state).toString("base64"),
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("[YouTube Connect] Error:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 }
    );
  }
}