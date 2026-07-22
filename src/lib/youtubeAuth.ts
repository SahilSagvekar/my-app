// src/lib/youtubeAuth.ts
//
// Dedicated OAuth client for YouTube uploads used by the review-mirror
// pipeline (see youtube-mirror.ts). Mirrors the pattern in googleAuth.ts —
// reuses the same Google account/refresh token as Drive mirroring, so one
// Google account handles both.
//
// IMPORTANT: GOOGLE_REFRESH_TOKEN must have been generated with the
// 'https://www.googleapis.com/auth/youtube.upload' scope granted (in
// addition to whatever Drive scope it already has — e.g. 'drive.file').
// If it was generated with get-refresh-token.js using only the Drive
// scope, YouTube uploads will fail with a 403 insufficientPermissions
// error. Regenerate the token with both scopes if that happens:
//
//   const SCOPES = [
//     'https://www.googleapis.com/auth/drive.file',
//     'https://www.googleapis.com/auth/youtube.upload',
//   ];

import { google } from "googleapis";

function getYoutubeOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    "https://e8-app.vercel.app/oauth2callback"
  );

  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return client;
}

/**
 * Returns an authenticated YouTube Data API v3 client, ready for
 * youtube.videos.insert() / .delete() calls.
 */
export function getYoutubeClient() {
  const auth = getYoutubeOAuthClient();
  return google.youtube({ version: "v3", auth });
}