import { google } from "googleapis";
import readline from "readline";
import 'dotenv/config';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('\n🔗 Visit this URL in your browser:\n');
console.log(authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('\nPaste the code from the URL here: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Your refresh token:\n');
    console.log(tokens.refresh_token);
    console.log('\n💾 Add this to your .env.local as GOOGLE_REFRESH_TOKEN');
    rl.close();
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    rl.close();
  }
});
