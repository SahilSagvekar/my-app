import { NextResponse } from "next/server";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BASE_URL}/api/auth/google/callback`
);

export async function GET() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["profile", "email"],
  });
  return NextResponse.redirect(authUrl);
}




// import { NextResponse } from "next/server";
// import { google } from "googleapis";

// export async function GET() {
//   const oauth2Client = new google.auth.OAuth2(
//     process.env.GOOGLE_CLIENT_ID,
//     process.env.GOOGLE_CLIENT_SECRET,
//     // process.env.GOOGLE_REDIRECT_URI
//     `${process.env.BASE_URL}/api/auth/google/callback`
//   );

//   const url = oauth2Client.generateAuthUrl({
//     access_type: "offline", // 🔑 Needed for refresh token
//     scope: ["https://www.googleapis.com/auth/drive.file"],
//     prompt: "consent", // 🔑 Forces Google to return refresh_token
//   });

//   return NextResponse.redirect(url);
// }
