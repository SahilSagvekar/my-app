import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.SLACK_CLIENT_ID!;
  const redirectUri = `${process.env.GOOGLE_REDIRECT_URI}/api/auth/slack/callback`;
  // const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=identity.basic,identity.email,identity.avatar&redirect_uri=${redirectUri}`;
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=identity.basic,identity.email,identity.avatar,identity.team&redirect_uri=https://b7c57502fdd0.ngrok-free.app/api/auth/slack/callback`;

  return NextResponse.redirect(slackAuthUrl);
}
