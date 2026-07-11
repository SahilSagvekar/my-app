export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// GET /api/tags — list all tags, for autocomplete/filter dropdowns
export async function GET(req: Request) {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    try {
        jwt.verify(token, process.env.JWT_SECRET!);
        const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
        return NextResponse.json({ ok: true, tags });
    } catch (err) {
        console.error("[GET /api/tags]", err);
        return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
    }
}

// POST /api/tags — create a tag if it doesn't already exist (case-insensitive)
export async function POST(req: Request) {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

    try {
        jwt.verify(token, process.env.JWT_SECRET!);
        const { name } = await req.json();
        const trimmed = (name || "").trim();
        if (!trimmed) return NextResponse.json({ ok: false, message: "name is required" }, { status: 400 });

        const existing = await prisma.tag.findFirst({
            where: { name: { equals: trimmed, mode: "insensitive" } },
        });
        if (existing) return NextResponse.json({ ok: true, tag: existing });

        const tag = await prisma.tag.create({ data: { name: trimmed } });
        return NextResponse.json({ ok: true, tag });
    } catch (err) {
        console.error("[POST /api/tags]", err);
        return NextResponse.json({ ok: false, message: "Server error" }, { status: 500 });
    }
}
