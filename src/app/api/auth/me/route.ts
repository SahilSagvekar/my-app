import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("cookie")?.split("authToken=")[1]?.split(";")[0];
    if (!token) return NextResponse.json({ message: "No token" }, { status: 401 });

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    return NextResponse.json({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    });
  } catch (err) {
    console.error("JWT verification error:", err);
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }
}
