export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tag } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { asc, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// GET /api/tags — list all tags, for autocomplete/filter dropdowns
export async function GET(req: Request) {
  const { db, closeDb } = getDb();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    try {
        jwt.verify(token, process.env.JWT_SECRET!);
        const tags = await db.select().from(tag).orderBy(asc(tag.name));
        return NextResponse.json({ ok: true, tags });
    } catch (err) {
        console.error("[GET /api/tags]", err);
        return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}

// POST /api/tags — create a tag if it doesn't already exist (case-insensitive)
export async function POST(req: Request) {
  const { db, closeDb } = getDb();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    try {
        jwt.verify(token, process.env.JWT_SECRET!);
        const { name } = await req.json();
        const trimmed = (name || "").trim();
        if (!trimmed) return NextResponse.json({ ok: false, message: "name is required" }, { status: 400 });

        // exact case-insensitive match — not a LIKE pattern (no % / _ wildcard expansion)
        const [existing] = await db.select().from(tag).where(sql`lower(${tag.name}) = lower(${trimmed})`).limit(1);
        if (existing) return NextResponse.json({ ok: true, tag: existing });

        const [created] = await db.insert(tag).values({ id: createId(), name: trimmed }).returning();
        return NextResponse.json({ ok: true, tag: created });
    } catch (err) {
        console.error("[POST /api/tags]", err);
        return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
    }

  } finally {
    await closeDb();
  }
}
