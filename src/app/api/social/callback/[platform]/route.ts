// src/app/api/social/callback/[platform]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

const TOKEN_CONFIGS: Record<string, {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}> = {
  youtube: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: process.env.GOOGLE_YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_YOUTUBE_CLIENT_SECRET || '',
  },
  instagram: {
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    clientId: process.env.INSTAGRAM_CLIENT_ID || '',
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
  },
  facebook: {
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    clientId: process.env.FACEBOOK_APP_ID || '',
    clientSecret: process.env.FACEBOOK_APP_SECRET || '',
  },
  tiktok: {
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    clientId: process.env.TIKTOK_CLIENT_KEY || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  },
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ platform: string }> }
) {
  // Next.js 15: params is a Promise - MUST await
  const { platform } = await context.params;
  const { searchParams } = new URL(req.url);

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectBase = `${appUrl}/dashboard`;

  console.log(`[SOCIAL CALLBACK] ========== START ==========`);
  console.log(`[SOCIAL CALLBACK] Platform: ${platform}`);

  // Handle OAuth errors from provider
  if (error) {
    console.error(`[SOCIAL CALLBACK] OAuth error:`, error, errorDescription);
    return NextResponse.redirect(
      `${redirectBase}?social_error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}?social_error=missing_params`);
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    const { clientId } = stateData;
    console.log(`[SOCIAL CALLBACK] Client ID: ${clientId}`);

    // Get token config
    const config = TOKEN_CONFIGS[platform];
    if (!config || !config.clientId || !config.clientSecret) {
      console.error(`[SOCIAL CALLBACK] Missing config for ${platform}`);
      return NextResponse.redirect(`${redirectBase}?social_error=missing_credentials`);
    }

    const redirectUri = `${appUrl}/api/social/callback/${platform}`;
    console.log(`[SOCIAL CALLBACK] Redirect URI: ${redirectUri}`);

    // Exchange code for tokens
    console.log(`[SOCIAL CALLBACK] Exchanging code for tokens...`);
    
    const tokenBody: Record<string, string> = {
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    };

    if (platform === 'tiktok') {
      delete tokenBody.client_id;
      tokenBody.client_key = config.clientId;
    }

    const tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenBody),
    });

    const tokenData = await tokenRes.json();
    console.log(`[SOCIAL CALLBACK] Token response status: ${tokenRes.status}`);
    
    if (!tokenRes.ok) {
      console.error(`[SOCIAL CALLBACK] Token exchange failed:`, JSON.stringify(tokenData));
      return NextResponse.redirect(
        `${redirectBase}?social_error=${encodeURIComponent(tokenData.error_description || tokenData.error || 'token_failed')}`
      );
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      console.error(`[SOCIAL CALLBACK] No access token:`, JSON.stringify(tokenData));
      return NextResponse.redirect(`${redirectBase}?social_error=no_access_token`);
    }

    console.log(`[SOCIAL CALLBACK] Got access token, fetching account info...`);

    // Get account info
    const accountInfo = await getAccountInfo(platform, accessToken);
    console.log(`[SOCIAL CALLBACK] Account:`, accountInfo.name, accountInfo.id);

    if (!accountInfo.id) {
      return NextResponse.redirect(`${redirectBase}?social_error=no_account_id`);
    }

    // Save to database
    await prisma.socialAccount.upsert({
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
        platformName: accountInfo.name || 'Unknown',
        accessToken: encrypt(accessToken),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        tokenExpiry: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
        profileUrl: accountInfo.url || null,
        profileImage: accountInfo.image || null,
        followerCount: accountInfo.followers || 0,
        isActive: true,
      },
      update: {
        platformName: accountInfo.name || 'Unknown',
        accessToken: encrypt(accessToken),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        tokenExpiry: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
        profileUrl: accountInfo.url || null,
        profileImage: accountInfo.image || null,
        followerCount: accountInfo.followers || 0,
        isActive: true,
      },
    });

    console.log(`[SOCIAL CALLBACK] SUCCESS: Connected ${platform} - ${accountInfo.name}`);
    return NextResponse.redirect(`${redirectBase}?social_connected=${platform}`);
    
  } catch (err: any) {
    console.error(`[SOCIAL CALLBACK] ERROR:`, err.message);
    console.error(err.stack);
    return NextResponse.redirect(
      `${redirectBase}?social_error=${encodeURIComponent(err.message || 'connection_failed')}`
    );
  }
}

async function getAccountInfo(platform: string, accessToken: string) {
  switch (platform) {
    case 'youtube': {
      const res = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'YouTube API failed');
      }
      const data = await res.json();
      const channel = data.items?.[0];
      if (!channel) throw new Error('No YouTube channel found');
      return {
        id: channel.id,
        name: channel.snippet?.title,
        url: `https://youtube.com/channel/${channel.id}`,
        image: channel.snippet?.thumbnails?.default?.url,
        followers: parseInt(channel.statistics?.subscriberCount || '0'),
      };
    }

    case 'instagram': {
      const res = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Instagram API failed');
      }
      const data = await res.json();
      return {
        id: data.id,
        name: data.username,
        url: `https://instagram.com/${data.username}`,
      };
    }

    case 'facebook': {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,picture,fan_count&access_token=${accessToken}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Facebook API failed');
      }
      const data = await res.json();
      const page = data.data?.[0];
      if (!page) throw new Error('No Facebook Page found');
      return {
        id: page.id,
        name: page.name,
        url: `https://facebook.com/${page.id}`,
        image: page.picture?.data?.url,
        followers: page.fan_count,
      };
    }

    case 'tiktok': {
      const res = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'TikTok API failed');
      }
      const data = await res.json();
      const user = data.data?.user;
      if (!user) throw new Error('No TikTok user found');
      return {
        id: user.open_id,
        name: user.display_name,
        image: user.avatar_url,
        followers: user.follower_count,
      };
    }

    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}