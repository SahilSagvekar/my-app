export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import { getDbHttp } from '@/lib/db';
import { user, auditLog } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getGeoLocation, formatLocation } from '@/lib/geo';
import { NextRequest, NextResponse } from "next/server";
import { validatePassword, buildPasswordContext, checkPasswordPwnedSafe, PASSWORD_RULES } from '@/lib/password-policy';

export async function POST(req: NextRequest) {
  const db = getDbHttp();
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

    // 🔒 Enforce password policy server-side — this is the authoritative
    // check; the register form's live checklist is just UX, never trust it.
    const [firstName, ...lastNameParts] = String(name || '').trim().split(/\s+/);
    const passwordContext = buildPasswordContext({ email, firstName, lastName: lastNameParts.join(' ') });
    const { valid, failedRuleIds } = validatePassword(password, passwordContext);
    if (!valid) {
      const failedLabels = PASSWORD_RULES.filter((r) => failedRuleIds.includes(r.id)).map((r) => r.label);
      return NextResponse.json(
        { message: `Password doesn't meet requirements: ${failedLabels.join('; ')}`, failedRules: failedRuleIds },
        { status: 400 }
      );
    }

    // Check against known-breach database (HaveIBeenPwned k-anonymity API).
    // Soft-fails open on network error — a third-party outage shouldn't
    // block registration entirely.
    const pwnedCount = await checkPasswordPwnedSafe(password);
    if (pwnedCount && pwnedCount > 0) {
      return NextResponse.json(
        { message: "This password has appeared in known data breaches. Please choose a different password." },
        { status: 400 }
      );
    }

    // Check if user exists
    const [existingUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);

    // The User table has a unique constraint on phone (User_phone_key) that
    // this route never checked for — a duplicate phone number throws a raw
    // Postgres constraint violation from the insert/update below, caught
    // only by the generic catch-all at the bottom (opaque "Server error",
    // real cause never surfaced). Checked here the same way email already
    // is, excluding the current user's own row so re-registering with your
    // own unchanged phone still works.
    const [existingPhone] = await db.select({ id: user.id }).from(user)
      .where(eq(user.phone, String(phone))).limit(1);
    if (existingPhone && existingPhone.id !== existingUser?.id) {
      return NextResponse.json({ message: "This phone number is already registered to another account" }, { status: 409 });
    }

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
  } catch (err: any) {
    // Public endpoint — never leak err.stack/cause to the client (unlike
    // the internal /api/drive/structure route). Logged in full here instead,
    // since a prior version of this catch block only logged the Error
    // object itself, which Cloudflare's logger serializes as just the
    // stack trace — the actual err.message never made it into the logs.
    console.error('Register error:', { message: err?.message, stack: err?.stack, cause: err?.cause });
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}