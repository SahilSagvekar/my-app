import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { name, email, password, acceptTerms } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    if (!acceptTerms) {
      return NextResponse.json({ message: "You must accept the terms and conditions" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ message: "Email already in use" }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
        // role: null,
      },
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "7d" }
    );

    // Set httpOnly cookie
    const response = NextResponse.json({
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    });
    response.cookies.set("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
