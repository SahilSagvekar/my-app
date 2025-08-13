import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req) {
  const body = await req.json();
  const { email, password, role } = body;

  if (!email || !password || !role) {
    return NextResponse.json(
      { message: "Email, password, and role are required" },
      { status: 400 }
    );
  }

  try {
    // const existingUser = await prisma.user.findUnique({
    //   where: { email },
    // });

    // if (existingUser) {
    //   return NextResponse.json(
    //     { message: "Email already registered" },
    //     { status: 409 }
    //   );
    // }

    const allowedRoles = [
      "admin",
      "manager",
      "editor",
      "videographer",
      "qc_specialist",
      "scheduler",
      "client",
    ];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ message: "Invalid role" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
      },
    });

    return NextResponse.json(
      { message: "User created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
