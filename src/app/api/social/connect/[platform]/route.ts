// src/app/api/social/connect/[platform]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';

const OAUTH_CONFIGS: Record<string, {
  authUrl: string;
  scopes: string[];
  clientId: string;
  extraParams?: Record<string, string>;
}> = {
  youtube: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
    clientId: process.env.GOOGLE_YOUTUBE_CLIENT_ID || '',
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  // Instagram Basic Display API is DEPRECATED (Dec 2024)
  // Instagram Business accounts are now connected via Facebook
  // Keeping this config commented for reference:
  // instagram: {
  //   authUrl: 'https://api.instagram.com/oauth/authorize',
  //   scopes: ['user_profile', 'user_media'],
  //   clientId: process.env.INSTAGRAM_CLIENT_ID || '',
  // },
  facebook: {
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic', // For Instagram Business accounts linked to Pages
    ],
    clientId: process.env.FACEBOOK_APP_ID || '',
  },
  tiktok: {
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    scopes: ['user.info.basic', 'video.list'],
    clientId: process.env.TIKTOK_CLIENT_KEY || '',
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const { platform } = await params;
    
    // Handle deprecated Instagram - redirect to Facebook
    if (platform === 'instagram') {
      console.log('[SOCIAL CONNECT] Instagram standalone is deprecated, redirecting to Facebook flow');
      const { searchParams } = new URL(req.url);
      const clientId = searchParams.get('clientId');
      return NextResponse.redirect(
        new URL(`/api/social/connect/facebook?clientId=${clientId}`, req.url)
      );
    }
    
    const config = OAUTH_CONFIGS[platform];

    if (!config) {
      return NextResponse.json(
        { error: `Invalid platform: ${platform}. Instagram is now connected via Facebook.` },
        { status: 400 }
      );
    }

    if (!config.clientId) {
      return NextResponse.json(
        { error: `${platform} is not configured. Please add API credentials.` },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    // Create state with client info (base64 encoded)
    const state = Buffer.from(
      JSON.stringify({
        clientId,
        userId: user.id,
        platform,
        timestamp: Date.now(),
      })
    ).toString('base64url');

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/social/callback/${platform}`;

    // Build OAuth URL
    const authUrl = new URL(config.authUrl);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    // Add platform-specific params
    if (config.extraParams) {
      Object.entries(config.extraParams).forEach(([key, value]) => {
        authUrl.searchParams.set(key, value);
      });
    }

    console.log(`[SOCIAL CONNECT] Redirecting to ${platform} OAuth:`, authUrl.toString());

    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error('[SOCIAL CONNECT] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}