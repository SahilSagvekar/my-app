import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { postedContent } from "@/lib/db/schema";
import { createId } from "@/lib/db/id";
import { and, eq, gte, lte, ilike, or, count as countFn, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getCurrentUser2 } from "@/lib/auth";
import { cached, invalidatePostedContentCache } from "@/lib/redis";

// GET - Fetch posted content for a client
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedClientId = searchParams.get("clientId");
    const platform = searchParams.get("platform");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const search = searchParams.get("search");
    const limit = parseInt(searchParams.get("limit") || "9999");
    const offset = parseInt(searchParams.get("offset") || "0");

    const isClient = user.role?.toLowerCase() === "client";
    let clientId = requestedClientId;

    if (isClient) {
      if (!user.linkedClientId) {
        return NextResponse.json({ message: "No client account linked to your user." }, { status: 403 });
      }
      clientId = user.linkedClientId;
    }

    // Build where clause
    const conditions: any[] = [];

    if (clientId) {
      conditions.push(eq(postedContent.clientId, clientId));
    }

    if (platform && platform !== "all") {
      conditions.push(eq(postedContent.platform, platform.toLowerCase()));
    }

    if (dateFrom) {
      const d = new Date(dateFrom + 'T00:00:00');
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false, timeZoneName: 'shortOffset' }).formatToParts(d);
      const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT-5';
      const offsetHours = parseInt((offsetStr.match(/GMT([+-]\d+)/) || ['', '-5'])[1], 10);
      const gteDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0 - offsetHours, 0, 0, 0));
      conditions.push(gte(postedContent.postedAt, gteDate.toISOString()));
    }
    if (dateTo) {
      const d = new Date(dateTo + 'T00:00:00');
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false, timeZoneName: 'shortOffset' }).formatToParts(d);
      const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT-5';
      const offsetHours = parseInt((offsetStr.match(/GMT([+-]\d+)/) || ['', '-5'])[1], 10);
      const lteDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23 - offsetHours, 59, 59, 999));
      conditions.push(lte(postedContent.postedAt, lteDate.toISOString()));
    }

    // Only return content linked to tasks that are SCHEDULED or POSTED
    // This prevents links added to in-progress tasks from appearing on the client screen
    // const scheduledTaskIds = await prisma.task.findMany({
    //   where: { status: { in: ['SCHEDULED', 'POSTED'] } },
    //   select: { id: true },
    // });
    // const validTaskIds = scheduledTaskIds.map(t => t.id);
    // Include content with no taskId (manually created) OR with a valid scheduled/posted task
    // const taskStatusFilter = {
    //   OR: [
    //     { taskId: null },
    //     { taskId: { in: validTaskIds } },
    //   ],
    // };

    // if (search) {
    //   where.AND = [
    //     taskStatusFilter,
    //     {
    //       OR: [
    //         { title: { contains: search, mode: "insensitive" } },
    //         { url: { contains: search, mode: "insensitive" } },
    //       ],
    //     },
    //   ];
    // } else {
    //   where.AND = [taskStatusFilter];
    // }

    if (search) {
      conditions.push(or(
        ilike(postedContent.title, `%${search}%`),
        ilike(postedContent.url, `%${search}%`),
      ));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    // Cache simple clientId-only reads for 60s
    const isSimpleRead = !!(clientId && !search && !dateFrom && !dateTo && !platform);
    const cacheKey = `posted-content:${clientId}:${offset}:${limit}`;

    const fetchData = async () => {
      const [rows, [{ value: total }]] = await Promise.all([
        db.query.postedContent.findMany({
          where,
          orderBy: desc(postedContent.postedAt),
          limit,
          offset,
          with: {
            client: {
              columns: {
                id: true,
                name: true,
                companyName: true,
              },
            },
          },
        }),
        db.select({ value: countFn() }).from(postedContent).where(where),
      ]);
      return { contents: rows, total };
    };

    const { contents, total } = isSimpleRead
      ? await cached(cacheKey, fetchData, 60)
      : await fetchData();

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

    const normalizedUrl = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;

    const [content] = await db.insert(postedContent).values({
      id: createId(),
      clientId,
      title,
      platform: platform.toLowerCase(),
      url: normalizedUrl,
      postedAt: (postedAt ? new Date(postedAt) : new Date()).toISOString(),
      deliverableType,
      taskId,
    }).returning();

    await invalidatePostedContentCache(clientId);

    return NextResponse.json(content, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/posted-content error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}