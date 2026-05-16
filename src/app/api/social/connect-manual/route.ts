export const dynamic = 'force-dynamic';
// POST /api/social/connect-manual
// Validates a pasted access token / refresh token against the real platform API,
// then saves the SocialAccount exactly like the OAuth callback would.
// This is the "Option 1" flow — no OAuth app verification needed.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { encrypt } from '@/lib/encryption';

// ── Per-platform validators ───────────────────────────────────────────────────
// Each function takes the token(s) the user pasted, hits the real platform API
// to verify they work, and returns the account info we need to store.

async function validateYouTube(refreshToken: string): Promise<{
  id: string; name: string; image: string; followers: number; url: string;
  accessToken: string; tokenExpiry: Date;
}> {
  // Exchange the refresh token for an access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_YOUTUBE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_YOUTUBE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Invalid refresh token: ${tokenData.error_description || tokenData.error || 'Token rejected by Google'}`);
  }

  const accessToken = tokenData.access_token;

  // Fetch channel info to verify the token actually works
  const channelRes = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const channelData = await channelRes.json();

  if (!channelRes.ok) {
    throw new Error(channelData.error?.message || 'Could not fetch YouTube channel');
  }

  const channel = channelData.items?.[0];
  if (!channel) throw new Error('No YouTube channel found for this token');

  return {
    id: channel.id,
    name: channel.snippet?.title || 'YouTube Channel',
    image: channel.snippet?.thumbnails?.default?.url || '',
    followers: parseInt(channel.statistics?.subscriberCount || '0'),
    url: `https://youtube.com/channel/${channel.id}`,
    accessToken,
    tokenExpiry: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000),
  };
}

async function validateFacebook(pageToken: string): Promise<{
  id: string; name: string; image: string; followers: number; url: string;
}> {
  // Verify the token and get the page it belongs to
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name,fan_count,followers_count,picture&access_token=${pageToken}`
  );
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Invalid Facebook Page token');
  }

  // A Page token returns the page directly as "me"
  if (!data.id) throw new Error('Token does not belong to a Facebook Page');

  return {
    id: data.id,
    name: data.name || 'Facebook Page',
    image: data.picture?.data?.url || '',
    followers: data.followers_count || data.fan_count || 0,
    url: `https://facebook.com/${data.id}`,
  };
}

async function validateTikTok(accessToken: string): Promise<{
  id: string; name: string; image: string; followers: number;
}> {
  const res = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();

  if (!res.ok || data.error?.code !== 'ok') {
    throw new Error(data.error?.message || 'Invalid TikTok access token');
  }

  const user = data.data?.user;
  if (!user) throw new Error('No TikTok user found for this token');

  return {
    id: user.open_id,
    name: user.display_name || 'TikTok Account',
    image: user.avatar_url || '',
    followers: user.follower_count || 0,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only admin/manager can connect accounts on behalf of clients
    const isAdmin = user.role === 'admin' || user.role === 'manager';
    if (!isAdmin) return NextResponse.json({ error: 'Only admins can connect social accounts' }, { status: 403 });

    const { platform, clientId, token, refreshToken } = await req.json();

    if (!platform || !clientId || !token) {
      return NextResponse.json({ error: 'platform, clientId and token are required' }, { status: 400 });
    }

    // Validate token against the real platform API
    let accountInfo: any;
    let accessToken = token;
    let tokenExpiry: Date | null = null;
    let storedRefreshToken = refreshToken || null;

    switch (platform) {
      case 'youtube': {
        // For YouTube, `token` is the refresh token
        const result = await validateYouTube(token);
        accountInfo = result;
        accessToken = result.accessToken;
        tokenExpiry = result.tokenExpiry;
        storedRefreshToken = token; // store the refresh token
        break;
      }
      case 'facebook': {
        // For Facebook, `token` is the long-lived Page access token (never expires)
        accountInfo = await validateFacebook(token);
        tokenExpiry = null; // Page tokens don't expire
        break;
      }
      case 'tiktok': {
        accountInfo = await validateTikTok(token);
        // TikTok tokens expire in 24h — user should also paste the refresh token
        tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        break;
      }
      default:
        return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
    }

    // Save to DB — same upsert as the OAuth callback
    const account = await prisma.socialAccount.upsert({
      where: {
        clientId_platform_platformId: {
          clientId,
          platform,
          platformId: accountInfo.id,
        },
      },
      create: {
        clientId,
        platform,
        platformId: accountInfo.id,
        platformName: accountInfo.name,
        accessToken: encrypt(accessToken),
        refreshToken: storedRefreshToken ? encrypt(storedRefreshToken) : null,
        tokenExpiry,
        profileUrl: accountInfo.url || null,
        profileImage: accountInfo.image || null,
        followerCount: accountInfo.followers || 0,
        isActive: true,
      },
      update: {
        platformName: accountInfo.name,
        accessToken: encrypt(accessToken),
        refreshToken: storedRefreshToken ? encrypt(storedRefreshToken) : null,
        tokenExpiry,
        profileUrl: accountInfo.url || null,
        profileImage: accountInfo.image || null,
        followerCount: accountInfo.followers || 0,
        isActive: true,
      },
      select: {
        id: true,
        platform: true,
        platformName: true,
        followerCount: true,
        profileImage: true,
      },
    });

    return NextResponse.json({
      ok: true,
      account,
      message: `Connected ${accountInfo.name} successfully`,
    });
  } catch (err: any) {
    console.error('[CONNECT-MANUAL]', err);
    return NextResponse.json({ error: err.message || 'Failed to connect account' }, { status: 400 });
  }
}