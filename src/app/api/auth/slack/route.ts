import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/slack`;
  
  const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackAuthUrl.searchParams.set('client_id', clientId!);
  slackAuthUrl.searchParams.set('redirect_uri', redirectUri);
  slackAuthUrl.searchParams.set('scope', 'identity.basic,identity.email,identity.avatar');
  slackAuthUrl.searchParams.set('user_scope', 'identity.basic,identity.email,identity.avatar');

  return NextResponse.redirect(slackAuthUrl.toString());
}