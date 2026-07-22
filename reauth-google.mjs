import { google } from "googleapis";
import readline from "readline";
import fs from "fs";
import path from "path";
import 'dotenv/config';

const ENV_PATH = path.resolve(process.cwd(), '.env');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/youtube.upload',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: SCOPES,
});

console.log('🔗 Visit this URL, approve access, then copy the "code" value from');
console.log('   the redirected URL (everything between "code=" and the next "&"):\n');
console.log(authUrl);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('\nPaste ONLY the code value here: ', async (rawCode) => {
  const code = rawCode.trim();

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.error('\n❌ No refresh_token in the response. This usually means you\'ve');
      console.error('   already authorized this app before without revoking it —');
      console.error('   Google only returns a refresh_token on first consent (or when');
      console.error('   prompt=consent forces re-consent, which this script already sets).');
      console.error('   Full response:', tokens);
      rl.close();
      return;
    }

    console.log('\n✅ Got a new refresh token (not printing it — writing straight to .env)');
    console.log('   Scopes granted:', tokens.scope);

    // ── Write directly into .env — no manual copy/paste step ──
    let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
    const line = `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`;

    if (/^GOOGLE_REFRESH_TOKEN=.*$/m.test(envContent)) {
      envContent = envContent.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line);
    } else {
      envContent = envContent.trimEnd() + `\n${line}\n`;
    }

    fs.writeFileSync(ENV_PATH, envContent, 'utf8');
    console.log(`✅ Wrote new GOOGLE_REFRESH_TOKEN into ${ENV_PATH}`);
    console.log('\nNext: restart the app (e.g. `pm2 restart e8-app --update-env`) and');
    console.log('run `node diagnose-youtube-auth.mjs` to confirm it refreshes cleanly.');

    rl.close();
  } catch (err) {
    console.error('\n❌ Error exchanging code:', err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
    rl.close();
  }
});
