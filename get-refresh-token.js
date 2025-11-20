import { google } from "googleapis";
import readline from "readline";
import 'dotenv/config';
import { TokenClass } from "typescript";

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

console.log('🔗 Visit this URL to authorize the application:' + authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('\nPaste the code from the URL here: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());

    console.log('\n✅ Refresh Token:', tokens);

    rl.close();
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    rl.close();
  }
});
