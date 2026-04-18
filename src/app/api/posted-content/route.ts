import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getCurrentUser2 } from "@/lib/auth";

// GET - Fetch posted content for a client
export async function GET(req: NextRequest) {
  try {
    // const authHeader = req.headers.get("authorization");
    // const token = authHeader?.replace("Bearer ", "") || "";
    // const verified = await verifyToken(token);
    // if (!verified) {
    //   return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    // }

    const user = await getCurrentUser2(req);
        if (!user) {
          return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
    

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId");
    const platform = searchParams.get("platform");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: any = {};

    if (clientId) {
      where.clientId = clientId;
    }

    if (platform && platform !== "all") {
      where.platform = platform.toLowerCase();
    }

    if (dateFrom || dateTo) {
      where.postedAt = {};
      if (dateFrom) where.postedAt.gte = new Date(dateFrom);
      if (dateTo) where.postedAt.lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { url: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch with pagination
    const [contents, total] = await Promise.all([
      prisma.postedContent.findMany({
        where,
        orderBy: { postedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          client: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
        },
      }),
      prisma.postedContent.count({ where }),
    ]);

    return NextResponse.json({
      contents,
      total,
      hasMore: offset + contents.length < total,
    });
  } catch (err: any) {
    console.error("GET /api/posted-content error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}

// POST - Create new posted content
export async function POST(req: NextRequest) {
  try {
    const token = await verifyToken(req);
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { clientId, title, platform, url, postedAt, deliverableType, taskId } = body;

    if (!clientId || !platform || !url) {
      return NextResponse.json(
        { message: "clientId, platform, and url are required" },
        { status: 400 }
      );
    }

    const content = await prisma.postedContent.create({
      data: {
        clientId,
        title,
        platform: platform.toLowerCase(),
        url,
        postedAt: postedAt ? new Date(postedAt) : new Date(),
        deliverableType,
        taskId,
      },
    });

    return NextResponse.json(content, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/posted-content error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}