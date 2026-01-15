import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    console.log("[LOGIN] 1. Request received");
    
    const { email, password } = await req.json();
    console.log("[LOGIN] 2. Body parsed:", email);

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    console.log("[LOGIN] 3. Finding user...");
    const user = await prisma.user.findFirst({ where: { email } });
    console.log("[LOGIN] 4. User found:", !!user);

    if (!user) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // if (!user.password) {
    //   console.log("[LOGIN] 5. No password set");
    //   return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    // }

    // console.log("[LOGIN] 5. Comparing password...");
    // const isPasswordValid = await bcrypt.compare(password, user.password);
    // console.log("[LOGIN] 6. Password valid:", isPasswordValid);

    // if (!isPasswordValid) {
    //   return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    // }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

    console.log("[LOGIN] 7. Signing token...");
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    console.log("[LOGIN] 8. Token signed");

    const response = NextResponse.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, name: user.name }
    });

    response.cookies.set("authToken", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    console.log("[LOGIN] 9. Done");
    return response;
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}