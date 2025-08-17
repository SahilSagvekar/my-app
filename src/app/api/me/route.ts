// src/app/api/me/route.ts
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const token = cookieHeader
      .split("; ")
      .find((row) => row.startsWith("authToken="))
      ?.split("=")[1];

    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");

    return NextResponse.json({ user: { id: decoded.userId, email: decoded.email, role: decoded.role } });
  } catch (err) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
