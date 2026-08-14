export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import { getDb } from '@/lib/db';
import { user, auditLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getGeoLocation, formatLocation } from '@/lib/geo';
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Fetch location data
  const locationData = await getGeoLocation(ip);
  const locationString = formatLocation(locationData);
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
    const [existingUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);

    if (existingUser) {
      if (existingUser.role === "client") {
        const hashedPassword = await bcrypt.hash(password, 10);

        const [updatedUser] = await db.update(user).set({
          name: name || existingUser.name,
          password: hashedPassword,
          phone: String(phone),
          updatedAt: new Date().toISOString(),
        }).where(eq(user.id, existingUser.id)).returning();

        // Add audit log for existing client registration
        await db.insert(auditLog).values({
          userId: updatedUser.id,
          action: 'CLIENT_SIGNUP_COMPLETE',
          entity: 'User',
          entityId: String(updatedUser.id),
          details: `Client completed registration from ${locationString}`,
          ipAddress: ip,
          userAgent: userAgent,
          metadata: {
            location: locationData,
            method: 'standard'
          } as any
        });

        if (!process.env.JWT_SECRET) {
          throw new Error("JWT_SECRET not configured");
        }

        const token = jwt.sign(
          { userId: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
          process.env.JWT_SECRET!,
          { expiresIn: "7d" }
        );

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
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 7 * 24 * 60 * 60,
          path: "/",
        });

        return response;
      } else {
        return NextResponse.json({ message: "Email already in use" }, { status: 409 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [newUser] = await db.insert(user).values({
      name: name || null,
      email,
      password: hashedPassword,
      phone: String(phone),
      updatedAt: new Date().toISOString(),
    }).returning();

    // Add audit log for new user signup
    await db.insert(auditLog).values({
      userId: newUser.id,
      action: 'USER_SIGNUP',
      entity: 'User',
      entityId: String(newUser.id),
      details: `New user signed up from ${locationString}`,
      ipAddress: ip,
      userAgent: userAgent,
      metadata: {
        location: locationData,
        method: 'standard'
      } as any
    });

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    });

    response.cookies.set("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }

  } finally {
    await closeDb();
  }
}