// src/app/api/social/refresh/route.ts
// Refresh OAuth tokens for social accounts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { encrypt, decrypt } from '@/lib/encryption';

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

// POST - Refresh token for an account
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Get account
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        clientId: true,
        platform: true,
        platformName: true,
        refreshToken: true,
        accessToken: true,
        tokenExpiry: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Verify access
    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isLinkedClient = user.linkedClientId === account.clientId;

    if (!isAdmin && !isLinkedClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if we have a refresh token
    if (!account.refreshToken) {
      return NextResponse.json(
        { 
          error: 'No refresh token available. Please reconnect the account.',
          needsReconnect: true,
        },
        { status: 400 }
      );
    }

    // Get token config
    const config = TOKEN_CONFIGS[account.platform];
    if (!config) {
      return NextResponse.json(
        { error: `Token refresh not supported for ${account.platform}` },
        { status: 400 }
      );
    }

    // Instagram doesn't support refresh in the same way
    if (account.platform === 'instagram') {
      // Instagram Basic Display API: exchange short-lived for long-lived token
      const decryptedToken = decrypt(account.accessToken);
      
      const res = await fetch(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${decryptedToken}`
      );
      
      const data = await res.json();
      
      if (!res.ok) {
        console.error('[TOKEN REFRESH] Instagram refresh failed:', data);
        return NextResponse.json(
          { 
            error: 'Token refresh failed. Please reconnect the account.',
            needsReconnect: true,
          },
          { status: 400 }
        );
      }

      await prisma.socialAccount.update({
        where: { id: accountId },
        data: {
          accessToken: encrypt(data.access_token),
          tokenExpiry: new Date(Date.now() + data.expires_in * 1000),
        },
      });

      return NextResponse.json({
        ok: true,
        message: 'Token refreshed successfully',
        expiresIn: data.expires_in,
      });
    }

    // Standard OAuth2 refresh flow
    const decryptedRefreshToken = decrypt(account.refreshToken);
    
    const body2: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: decryptedRefreshToken,
    };

    // Platform-specific params
    if (account.platform === 'youtube') {
      body2.client_id = config.clientId;
      body2.client_secret = config.clientSecret;
    } else if (account.platform === 'facebook') {
      body2.client_id = config.clientId;
      body2.client_secret = config.clientSecret;
    } else if (account.platform === 'tiktok') {
      body2.client_key = config.clientId;
      body2.client_secret = config.clientSecret;
    }

    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body2),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(`[TOKEN REFRESH] ${account.platform} refresh failed:`, data);
      return NextResponse.json(
        { 
          error: 'Token refresh failed. Please reconnect the account.',
          needsReconnect: true,
        },
        { status: 400 }
      );
    }

    // Update tokens
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: {
        accessToken: encrypt(data.access_token),
        refreshToken: data.refresh_token 
          ? encrypt(data.refresh_token) 
          : account.refreshToken,
        tokenExpiry: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : null,
      },
    });

    console.log(`[TOKEN REFRESH] Successfully refreshed ${account.platform}: ${account.platformName}`);

    return NextResponse.json({
      ok: true,
      message: 'Token refreshed successfully',
      expiresIn: data.expires_in,
    });
  } catch (error: any) {
    console.error('[TOKEN REFRESH] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Check token status for all accounts of a client
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Verify access
    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isLinkedClient = user.linkedClientId === clientId;

    if (!isAdmin && !isLinkedClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const accounts = await prisma.socialAccount.findMany({
      where: { clientId },
      select: {
        id: true,
        platform: true,
        platformName: true,
        tokenExpiry: true,
        isActive: true,
        refreshToken: true,
      },
    });

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;

    return NextResponse.json({
      ok: true,
      accounts: accounts.map(a => {
        const expiry = a.tokenExpiry?.getTime() || 0;
        const hasRefreshToken = !!a.refreshToken;
        
        let status: 'valid' | 'expiring_soon' | 'expired' | 'unknown' = 'unknown';
        
        if (!a.tokenExpiry) {
          status = 'unknown';
        } else if (expiry < now) {
          status = 'expired';
        } else if (expiry - now < oneDay) {
          status = 'expiring_soon';
        } else {
          status = 'valid';
        }

        return {
          id: a.id,
          platform: a.platform,
          platformName: a.platformName,
          isActive: a.isActive,
          tokenStatus: status,
          canRefresh: hasRefreshToken,
          expiresAt: a.tokenExpiry?.toISOString(),
        };
      }),
    });
  } catch (error: any) {
    console.error('[TOKEN STATUS] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}