export const dynamic = 'force-dynamic';
// import { NextResponse } from "next/server";
// import { google } from "googleapis";
// import jwt from "jsonwebtoken";
// import { prisma } from "@/lib/prisma";

import { NextResponse } from "next/server";
import { google } from "googleapis";
import formidable from "formidable";
import fs from "fs";
import jwt from "jsonwebtoken";
import { getDb } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
  const { db, closeDb } = getDb();
  try {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  let [user] = await db.select().from(userTable).where(eq(userTable.email, data.email!)).limit(1);
  if (!user) {
    [user] = await db.insert(userTable).values({
      email: data.email!,
      name: data.name ?? "",
      role: "client", // default role for OAuth users
      updatedAt: new Date().toISOString(),
    }).returning();
  }

  if (user.employeeStatus !== 'ACTIVE' && user.email !== 'sahilsagvekar230@gmail.com') {
    return NextResponse.redirect(`${process.env.BASE_URL}/login?error=account_deactivated`);
  }

  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  const response = NextResponse.redirect(`${process.env.BASE_URL}/dashboard`);
  response.cookies.set("authToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return response;

  } finally {
    await closeDb();
  }
}
