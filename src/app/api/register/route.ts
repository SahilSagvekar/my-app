import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { name, email, phone, password, acceptTerms } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ message: "Phone is required" }, { status: 400 });
    }

    if (!acceptTerms) {
      return NextResponse.json({ message: "You must accept the terms and conditions" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({ where: { email } });

    if (existingUser) {
      // If user exists and is a client, allow them to update their info
      if (existingUser.role === "client") {
        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update existing client user
        const updatedUser = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: name || existingUser.name,
            password: hashedPassword,
            phone: String(phone),
          },
        });

        // Generate JWT
        const token = jwt.sign(
          { userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
          process.env.JWT_SECRET || "your_jwt_secret",
          { expiresIn: "7d" }
        );

        // Set httpOnly cookie
        const response = NextResponse.json({
          user: { 
            id: updatedUser.id, 
            name: updatedUser.name, 
            email: updatedUser.email, 
            role: updatedUser.role 
          },
          message: "Registration completed successfully",
        });
        response.cookies.set("authToken", token, {
          httpOnly: true,
          secure: false,
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60,
          path: "/",
        });

        return response;
      } else {
        // If user exists but is not a client (admin, manager, etc.)
        return NextResponse.json({ message: "Email already in use" }, { status: 409 });
      }
    }

    // If user doesn't exist at all, create new user (non-client registration)
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: name || null,
        email,
        password: hashedPassword,
        phone: String(phone),
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
      secure: false,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
