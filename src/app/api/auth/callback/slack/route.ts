import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateOAuthUser, generateAuthToken } from '@/lib/oauth';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.url));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/slack`,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.ok || !tokens.authed_user?.access_token) {
      throw new Error('No access token received from Slack');
    }

    // Get user info
    const userInfoResponse = await fetch('https://slack.com/api/users.identity', {
      headers: { 
        Authorization: `Bearer ${tokens.authed_user.access_token}` 
      },
    });

    const userInfo = await userInfoResponse.json();

    if (!userInfo.ok) {
      throw new Error('Failed to get Slack user info');
    }

    // Find or create user
    const user = await findOrCreateOAuthUser(
      'slack',
      userInfo.user.id,
      userInfo.user.email,
      userInfo.user.name
    );

    // Generate JWT token
    const token = generateAuthToken(user.id, user.role);

    // Redirect to dashboard with token
    const response = NextResponse.redirect(new URL('/dashboard', req.url));
    response.cookies.set('authToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Slack OAuth error:', error);
    return NextResponse.redirect(new URL('/login?error=oauth_failed', req.url));
  }
}