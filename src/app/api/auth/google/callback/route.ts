// import { NextResponse } from "next/server";
// import { google } from "googleapis";
// import jwt from "jsonwebtoken";
// import { prisma } from "@/lib/prisma";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import formidable from "formidable";
import fs from "fs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.BASE_URL}/api/auth/google/callback`
);

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  let user = await prisma.user.findUnique({ where: { email: data.email! } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: data.email!,
        name: data.name ?? "",
        role: "client", // default role for OAuth users
      },
    });
  }

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "1h" }
  );

  const response = NextResponse.redirect(`${process.env.BASE_URL}/dashboard`);
  response.cookies.set("authToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60,
    path: "/",
  });

  return response;
}
