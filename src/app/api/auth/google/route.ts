import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline", // 🔑 Needed for refresh token
    scope: ["https://www.googleapis.com/auth/drive.file"],
    prompt: "consent", // 🔑 Forces Google to return refresh_token
  });

  return NextResponse.redirect(url);
}
