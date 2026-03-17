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
  instagram: {
    authUrl: 'https://api.instagram.com/oauth/authorize',
    scopes: ['user_profile', 'user_media'],
    clientId: process.env.INSTAGRAM_CLIENT_ID || '',
  },
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      // 'pages_read_user_content',
      // 'instagram_basic',
      // 'instagram_manage_insights',
      // 'read_insights',
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
  const { platform } = await params;
  const { searchParams } = new URL(req.url);
 
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
 
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
 
  // Handle OAuth errors
  if (error) {
    console.error(`[SOCIAL CALLBACK] OAuth error for ${platform}:`, error, errorDescription);
    return NextResponse.redirect(
      `${appUrl}/client/analytics?error=${encodeURIComponent(errorDescription || error)}`
    );
  }
 
  if (!code || !state) {
    return NextResponse.redirect(
      `${appUrl}/client/analytics?error=missing_params`
    );
  }
 
  try {
    // Decode state
    let stateData: { clientId: string; userId: number; platform: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      return NextResponse.redirect(
        `${appUrl}/client/analytics?error=invalid_state`
      );
    }
 
    const { clientId, userId } = stateData;
 
    // Get token config
    const config = TOKEN_CONFIGS[platform];
    if (!config) {
      return NextResponse.redirect(
        `${appUrl}/client/analytics?error=invalid_platform`
      );
    }
 
    const redirectUri = `${appUrl}/api/social/callback/${platform}`;
 
    console.log(`[SOCIAL CALLBACK] Processing ${platform} callback`);
    console.log(`[SOCIAL CALLBACK] Client ID: ${clientId}`);
    console.log(`[SOCIAL CALLBACK] Redirect URI: ${redirectUri}`);
 
    // Exchange code for tokens
    console.log(`[SOCIAL CALLBACK] Exchanging code for tokens...`);
    const tokens = await exchangeCodeForTokens(platform, code, redirectUri, config);
    console.log(`[SOCIAL CALLBACK] Got tokens:`, { 
      hasAccessToken: !!tokens.access_token, 
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in 
    });
 
    if (!tokens.access_token) {
      console.error(`[SOCIAL CALLBACK] No access token received for ${platform}`);
      return NextResponse.redirect(
        `${appUrl}/client/analytics?error=no_access_token`
      );
    }
 
    // Get account info from the platform
    console.log(`[SOCIAL CALLBACK] Fetching account info...`);
    const accountInfo = await getAccountInfo(platform, tokens.access_token);
    console.log(`[SOCIAL CALLBACK] Account info:`, accountInfo);
 
    if (!accountInfo.id) {
      console.error(`[SOCIAL CALLBACK] No account ID received for ${platform}`);
      return NextResponse.redirect(
        `${appUrl}/client/analytics?error=no_account_id`
      );
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
        platformName: accountInfo.name || accountInfo.username || 'Unknown',
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiry: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
        profileUrl: accountInfo.url,
        profileImage: accountInfo.image,
        followerCount: accountInfo.followers || 0,
        isActive: true,
      },
      update: {
        platformName: accountInfo.name || accountInfo.username || 'Unknown',
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiry: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
        profileUrl: accountInfo.url,
        profileImage: accountInfo.image,
        followerCount: accountInfo.followers || 0,
        isActive: true,
      },
    });
 
    console.log(`[SOCIAL CALLBACK] Successfully connected ${platform} account: ${accountInfo.name}`);
 
    return NextResponse.redirect(
      `${appUrl}/client/analytics?connected=${platform}`
    );
  } catch (err: any) {
    console.error(`[SOCIAL CALLBACK] Error for ${platform}:`, err);
    console.error(`[SOCIAL CALLBACK] Error stack:`, err.stack);
    console.error(`[SOCIAL CALLBACK] Redirecting to: ${appUrl}/dashboard?social_error=${encodeURIComponent(err.message || 'connection_failed')}`);
    
    // Redirect to dashboard since /client/analytics might not exist for all users
    return NextResponse.redirect(
      `${appUrl}/dashboard?social_error=${encodeURIComponent(err.message || 'connection_failed')}`
    );
  }
}
 
async function exchangeCodeForTokens(
  platform: string,
  code: string,
  redirectUri: string,
  config: { tokenUrl: string; clientId: string; clientSecret: string }
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const body: Record<string, string> = {
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  };
 
  // Platform-specific token request formats
  if (platform === 'youtube') {
    body.client_id = config.clientId;
    body.client_secret = config.clientSecret;
  } else if (platform === 'instagram') {
    body.client_id = config.clientId;
    body.client_secret = config.clientSecret;
  } else if (platform === 'facebook') {
    body.client_id = config.clientId;
    body.client_secret = config.clientSecret;
  } else if (platform === 'tiktok') {
    body.client_key = config.clientId;
    body.client_secret = config.clientSecret;
  }
 
  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  });
 
  const data = await res.json();
 
  if (!res.ok) {
    console.error(`[TOKEN EXCHANGE] Failed for ${platform}:`, data);
    throw new Error(data.error_description || data.error || 'Token exchange failed');
  }
 
  return data;
}
 
async function getAccountInfo(
  platform: string,
  accessToken: string
): Promise<{
  id: string;
  name?: string;
  username?: string;
  url?: string;
  image?: string;
  followers?: number;
}> {
  switch (platform) {
    case 'youtube': {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
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
      // For Instagram Basic Display API
      const res = await fetch(
        `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`
      );
      const data = await res.json();
      
      return {
        id: data.id,
        username: data.username,
        name: data.username,
        url: `https://instagram.com/${data.username}`,
      };
    }
 
    case 'facebook': {
      // Try to get Facebook Pages first
      const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,picture,fan_count&access_token=${accessToken}`
      );
      const pagesData = await pagesRes.json();
      
      console.log(`[SOCIAL CALLBACK] Facebook pages response:`, JSON.stringify(pagesData));
      
      const page = pagesData.data?.[0];
      
      if (page) {
        // User has a Facebook Page - use it
        return {
          id: page.id,
          name: page.name,
          url: `https://facebook.com/${page.id}`,
          image: page.picture?.data?.url,
          followers: page.fan_count || 0,
        };
      }
      
      // No Page found - fallback to personal profile
      console.log(`[SOCIAL CALLBACK] No Facebook Page found, using personal profile`);
      
      const profileRes = await fetch(
        `https://graph.facebook.com/v19.0/me?fields=id,name,picture&access_token=${accessToken}`
      );
      const profileData = await profileRes.json();
      
      console.log(`[SOCIAL CALLBACK] Facebook profile response:`, JSON.stringify(profileData));
      
      if (!profileData.id) {
        throw new Error('Could not fetch Facebook profile');
      }
      
      return {
        id: profileData.id,
        name: profileData.name || 'Facebook Profile',
        url: `https://facebook.com/${profileData.id}`,
        image: profileData.picture?.data?.url,
        followers: 0, // Personal profiles don't expose friend count
      };
    }
 
    case 'tiktok': {
      const res = await fetch(
        `https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,follower_count`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json();
      const user = data.data?.user;
      
      if (!user) throw new Error('No TikTok user found');
      
      return {
        id: user.open_id || user.union_id,
        name: user.display_name,
        image: user.avatar_url,
        followers: user.follower_count,
      };
    }
 
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

// export async function GET(
//   req: NextRequest,
//   { params }: { params: Promise<{ platform: string }> }
// ) {
//   try {
//     const user = await getCurrentUser2(req);
//     if (!user) {
//       return NextResponse.redirect(new URL('/login', req.url));
//     }

//     const { platform } = await params;
//     const config = OAUTH_CONFIGS[platform];

//     if (!config) {
//       return NextResponse.json(
//         { error: `Invalid platform: ${platform}` },
//         { status: 400 }
//       );
//     }

//     if (!config.clientId) {
//       return NextResponse.json(
//         { error: `${platform} is not configured. Please add API credentials.` },
//         { status: 500 }
//       );
//     }

//     const { searchParams } = new URL(req.url);
//     const clientId = searchParams.get('clientId');

//     if (!clientId) {
//       return NextResponse.json(
//         { error: 'clientId is required' },
//         { status: 400 }
//       );
//     }

//     // Verify user has access to this client
//     // const isAdmin = user.role === 'admin' || user.role === 'manager';
//     // const isLinkedClient = user.linkedClientId === clientId;

//     // if (!isAdmin && !isLinkedClient) {
//     //   return NextResponse.json(
//     //     { error: 'Access denied' },
//     //     { status: 403 }
//     //   );
//     // }

//     // Create state with client info (base64 encoded)
//     const state = Buffer.from(
//       JSON.stringify({
//         clientId,
//         userId: user.id,
//         platform,
//         timestamp: Date.now(),
//       })
//     ).toString('base64url');

//     const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/social/callback/${platform}`;

//     // Build OAuth URL
//     const authUrl = new URL(config.authUrl);
//     authUrl.searchParams.set('client_id', config.clientId);
//     authUrl.searchParams.set('redirect_uri', redirectUri);
//     authUrl.searchParams.set('scope', config.scopes.join(' '));
//     authUrl.searchParams.set('response_type', 'code');
//     authUrl.searchParams.set('state', state);

//     // Add platform-specific params
//     if (config.extraParams) {
//       Object.entries(config.extraParams).forEach(([key, value]) => {
//         authUrl.searchParams.set(key, value);
//       });
//     }

//     console.log(`[SOCIAL CONNECT] Redirecting to ${platform} OAuth:`, authUrl.toString());

//     return NextResponse.redirect(authUrl.toString());
//   } catch (error: any) {
//     console.error('[SOCIAL CONNECT] Error:', error);
//     return NextResponse.json(
//       { error: error.message || 'Internal server error' },
//       { status: 500 }
//     );
//   }
// }