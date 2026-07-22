import { google } from "googleapis";
import 'dotenv/config';

function redact(s) {
  if (!s) return '(not set)';
  if (s.length <= 10) return `${s.slice(0, 3)}***`;
  return `${s.slice(0, 6)}...${s.slice(-6)} (len ${s.length})`;
}

console.log('=== Env vars this process is actually loading ===');
console.log('GOOGLE_OAUTH_CLIENT_ID:', redact(process.env.GOOGLE_OAUTH_CLIENT_ID));
console.log('GOOGLE_OAUTH_CLIENT_SECRET:', redact(process.env.GOOGLE_OAUTH_CLIENT_SECRET));
console.log('GOOGLE_REFRESH_TOKEN:', redact(process.env.GOOGLE_REFRESH_TOKEN));
console.log('Server clock (UTC):', new Date().toISOString());
console.log('');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

console.log('=== Attempting to refresh the access token ===');
try {
  const { credentials } = await oauth2Client.refreshAccessToken();
  console.log('✅ Access token refresh succeeded');
  console.log('Scopes granted:', credentials.scope);
  console.log('Expires:', new Date(credentials.expiry_date).toISOString());

  // Now actually test it against the YouTube API
  console.log('\n=== Testing YouTube API call (channels.list mine=true) ===');
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  const res = await youtube.channels.list({ part: ['snippet'], mine: true });
  const channel = res.data.items?.[0];
  if (channel) {
    console.log(`✅ YouTube API call succeeded — authenticated as channel: "${channel.snippet.title}" (${channel.id})`);
  } else {
    console.log('⚠️  YouTube API call succeeded but returned no channel — this token may not be tied to any YouTube channel at all.');
  }
} catch (err) {
  console.error('❌ Failed:', err.message);
  if (err.response?.data) {
    console.error('Full error response:', JSON.stringify(err.response.data, null, 2));
  }
}
