import { google } from "googleapis";

export function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.BASE_URL}/oauth2callback`
  );

  // Set the refresh token for server-side auth
  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return client;
}

export function drive() {
  const auth = getOAuthClient();
  return google.drive({ version: "v3", auth });
}
