import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "1h" }
    );

    const response = NextResponse.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.name }
    });

    // Set httpOnly cookie
    response.cookies.set("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // ✅ Only secure in prod
      sameSite: "strict",
      maxAge: 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
