export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import { getDbHttp } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from "next/server";
import { issueLoginSession } from '@/lib/auth-session';

export async function POST(req: NextRequest) {
  const db = getDbHttp();
  try {
    console.log("[LOGIN] 1. Request received");

    const { email, password } = await req.json();
    console.log("[LOGIN] 2. Body parsed:", email);

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 });
    }

    console.log("[LOGIN] 3. Finding user...");
    const [foundUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    console.log("[LOGIN] 4. User found:", !!foundUser);

    if (!foundUser) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    if (foundUser.employeeStatus !== 'ACTIVE' && foundUser.email !== 'sahilsagvekar230@gmail.com') {
      return NextResponse.json({ message: "Account is deactivated. Please contact support." }, { status: 403 });
    }

    if (!foundUser.password) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    console.log("[LOGIN] 5. Comparing password...");
    const isPasswordValid = await bcrypt.compare(password, foundUser.password);
    console.log("[LOGIN] 6. Password valid:", isPasswordValid);

    if (!isPasswordValid) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    console.log("[LOGIN] 7. Password verified — issuing session");
    return await issueLoginSession(
      {
        id: String(foundUser.id),
        email: foundUser.email,
        role: foundUser.role,
        roles: foundUser.roles ?? [],
        name: foundUser.name,
      },
      req
    );

    console.log("[LOGIN] 8. Session issued, login complete");
    return NextResponse.json({
      message: "Login successful",
      email: foundUser.email,
    });
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    if (err instanceof Error && err.cause) {
      console.error("[LOGIN] Root cause:", err.cause);
    }
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}