// scripts/regenerate-drive-token.js
//
// Regenerates GOOGLE_REFRESH_TOKEN — the OAuth2 refresh token that
// e8-file-server uses to upload files to Google Drive for client-review
// mirroring (getOAuthDrive() in src/index.js).
//
// WHY THIS EXPIRES / STOPS WORKING:
//   - If the OAuth Client's consent screen in Google Cloud Console is still
//     in "Testing" publishing status, Google auto-expires refresh tokens
//     after 7 days. This is the #1 cause of drive-mirror silently failing.
//   - If the Google account owner changed their password, or manually
//     revoked access at https://myaccount.google.com/permissions.
//   - If the OAuth Client ID/Secret itself was regenerated in Cloud Console.
//
// IMPORTANT: You must sign in with the SAME Google account that owns the
// Drive folder tree under GOOGLE_DRIVE_PARENT_ID. Signing in with a
// different account will "work" (you'll get a valid token) but new
// mirrored files will land in the wrong person's Drive, invisible to
// everyone else, and existing GOOGLE_DRIVE_PARENT_ID lookups will fail.
//
// USAGE:
//   1. cd e8-file-server
//   2. node scripts/regenerate-drive-token.js
//   3. Open the printed URL, sign in with the correct Google account,
//      approve access.
//   4. If GOOGLE_REDIRECT_URI is a localhost URL, this script catches the
//      callback automatically and prints the new refresh token.
//      If it's a real domain (production), Google will redirect there
//      instead — paste the FULL redirected URL (or just the ?code=...
//      value) back into this script's terminal prompt when asked.
//   5. Copy the printed refresh_token into GOOGLE_REFRESH_TOKEN in your
//      .env (or wherever it's set — e.g. PM2 ecosystem file / EC2 env),
//      then restart the file-server: pm2 restart e8-file-server

require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const { URL } = require('url');
const readline = require('readline');

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in your .env');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// prompt: 'consent' forces Google to hand back a refresh_token even if this
// app was already authorized before — without it, re-consenting to an
// already-approved app can silently return no refresh_token at all.
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
});

console.log('='.repeat(70));
console.log('1. Open this URL and sign in with the Drive-mirroring account:');
console.log('='.repeat(70));
console.log(authUrl);
console.log('='.repeat(70));

async function exchangeCode(code) {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Success!\n');
    if (!tokens.refresh_token) {
      console.log(
        '⚠️  No refresh_token was returned. This usually means Google still\n' +
          '   remembers a prior consent for this exact account+client and\n' +
          '   skipped issuing a new one. Revoke access at\n' +
          '   https://myaccount.google.com/permissions (find this app and\n' +
          '   remove it) and run this script again.'
      );
      process.exit(1);
    }
    console.log('GOOGLE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\nCopy that line into the file-server .env, then:');
    console.log('  pm2 restart e8-file-server');
  } catch (err) {
    console.error('❌ Failed to exchange code for tokens:', err.message || err);
    process.exit(1);
  }
}

let redirectUrl;
try {
  redirectUrl = new URL(REDIRECT_URI);
} catch {
  redirectUrl = null;
}

const isLocal = redirectUrl && (redirectUrl.hostname === 'localhost' || redirectUrl.hostname === '127.0.0.1');

if (isLocal) {
  const port = Number(redirectUrl.port) || 80;
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    if (reqUrl.pathname !== redirectUrl.pathname) {
      res.writeHead(404);
      res.end();
      return;
    }
    const code = reqUrl.searchParams.get('code');
    const error = reqUrl.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Google returned an error: ${error}`);
      console.error(`❌ Google returned an error: ${error}`);
      server.close();
      process.exit(1);
    }

    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Done — you can close this tab and go back to your terminal.');
    server.close();
    await exchangeCode(code);
  });

  server.listen(port, () => {
    console.log(`\n2. Waiting for the OAuth redirect on ${REDIRECT_URI} ...`);
  });
} else {
  console.log(
    `\n2. GOOGLE_REDIRECT_URI ("${REDIRECT_URI}") is not localhost, so this\n` +
      '   script can\'t catch the callback automatically. After approving\n' +
      '   access, your browser will land on that URL (it may show an error\n' +
      "   page if nothing's listening there — that's fine). Copy the\n" +
      '   "code" query parameter value (or the full URL) from the address\n' +
      '   bar and paste it below.\n'
  );
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('Paste the code (or full redirect URL) here: ', async (answer) => {
    rl.close();
    let code = answer.trim();
    // Allow pasting the whole redirected URL instead of just the code.
    if (code.includes('code=')) {
      try {
        const parsed = new URL(code);
        code = parsed.searchParams.get('code') || code;
      } catch {
        const match = code.match(/[?&]code=([^&]+)/);
        if (match) code = decodeURIComponent(match[1]);
      }
    }
    await exchangeCode(code);
  });
}