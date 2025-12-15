import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      // redirect_uri: `${process.env.GOOGLE_REDIRECT_URI}/api/auth/slack/callback`,
      redirect_uri: `https://b7c57502fdd0.ngrok-free.app/api/auth/slack/callback`,
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    return NextResponse.json({ error: "Slack auth failed" }, { status: 400 });
  }

  const email = data.authed_user.email || data.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Slack user email not available" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: data.authed_user.name || "Slack User",
        role: "client",
      },
    });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  const redirect = NextResponse.redirect(`${process.env.GOOGLE_REDIRECT_URI}/dashboard`);
  redirect.cookies.set("authToken", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return redirect;
}
