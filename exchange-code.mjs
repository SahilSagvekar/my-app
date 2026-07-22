import { google } from "googleapis";
import 'dotenv/config';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_OAUTH_CLIENT_ID,
  process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Paste just the `code` value from the redirected URL (everything between
// "code=" and the next "&") — already filled in below from your last message.
const code = "4/0AXEQxIAXatUXoGnt6yo9yl8wq5eO_7DNAmRTTSnO6Xq_6l4nTau7HxRrOdleXOSThsevZQ";

try {
  const { tokens } = await oauth2Client.getToken(code.trim());
  console.log("\n✅ Tokens:", tokens);
  console.log("\n👉 Copy this into GOOGLE_REFRESH_TOKEN:\n", tokens.refresh_token);
} catch (err) {
  console.error("\n❌ Error:", err.message);
}
