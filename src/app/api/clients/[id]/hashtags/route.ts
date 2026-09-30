export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getDbHttp } from "@/lib/db";
import { client } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { getUserFromToken, hasRole } from "@/lib/auth-helpers";
import { sendToChannel } from "@/lib/slack";

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

// GET /api/clients/:id/hashtags — the client's template hashtag list,
// used by the review screen to populate the tag-selection dropdown.
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const token = getTokenFromCookies(req);
    if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    jwt.verify(token, process.env.JWT_SECRET!);

    const { id } = await context.params;
    if (!id) return NextResponse.json({ message: "Client id required" }, { status: 400 });

    const [foundClient] = await db.select({ templateHashtags: client.templateHashtags }).from(client).where(eq(client.id, id)).limit(1);

    if (!foundClient) return NextResponse.json({ message: "Client not found" }, { status: 404 });

    return NextResponse.json({ hashtags: foundClient.templateHashtags ?? [] });
  } catch (err) {
    console.error("[GET /api/clients/:id/hashtags]", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

const MAX_HASHTAGS = 200;
const MAX_HASHTAG_LENGTH = 100;

// PUT /api/clients/:id/hashtags — replace the client's template hashtag list.
// Body: { hashtags: string[] }
//
// Used by the Guidelines Management form so staff can maintain a client's
// hashtags without going through the full client editor. That editor's
// PUT /api/clients/:id is deliberately NOT reused here: it rewrites the whole
// client record (emails, phones, review flags, deliverables…) from the
// request body, so a hashtags-only call to it would reset everything else.
// This handler only ever touches templateHashtags (and updatedAt).
//
// Same access rule as the client editor (admin or manager), and the same
// "new hashtags added" note to the scheduling channel — additions only,
// never removals.
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const db = getDbHttp();
  try {
    const currentUser = getUserFromToken(req);
    if (!currentUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!hasRole(currentUser, "admin") && !hasRole(currentUser, "manager")) {
      return NextResponse.json({ message: "Access denied" }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id) return NextResponse.json({ message: "Client id required" }, { status: 400 });

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.hashtags) || body.hashtags.some((t: unknown) => typeof t !== "string")) {
      return NextResponse.json({ message: "hashtags must be an array of strings" }, { status: 400 });
    }

    // Trim, drop blanks, and de-duplicate (exact match, first one wins).
    const cleaned: string[] = [];
    for (const raw of body.hashtags as string[]) {
      const tag = raw.trim();
      if (!tag || cleaned.includes(tag)) continue;
      if (tag.length > MAX_HASHTAG_LENGTH) {
        return NextResponse.json({ message: `Hashtags can be at most ${MAX_HASHTAG_LENGTH} characters` }, { status: 400 });
      }
      cleaned.push(tag);
    }
    if (cleaned.length > MAX_HASHTAGS) {
      return NextResponse.json({ message: `A client can have at most ${MAX_HASHTAGS} hashtags` }, { status: 400 });
    }

    const [existing] = await db
      .select({ templateHashtags: client.templateHashtags })
      .from(client)
      .where(eq(client.id, id))
      .limit(1);
    if (!existing) return NextResponse.json({ message: "Client not found" }, { status: 404 });

    const previous = existing.templateHashtags ?? [];

    const [updated] = await db
      .update(client)
      .set({
        templateHashtags: cleaned,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(client.id, id))
      .returning({
        templateHashtags: client.templateHashtags,
        name: client.name,
        companyName: client.companyName,
      });

    const added = cleaned.filter((t) => !previous.includes(t));
    if (added.length > 0) {
      const clientDisplayName = updated?.companyName || updated?.name || "A client";
      try {
        await sendToChannel("scheduling", {
          type: "client_hashtags_added",
          message: `:label: *${clientDisplayName}* — ${added.length} new hashtag${added.length === 1 ? "" : "s"} added: ${added.map((t) => `\`${t}\``).join(", ")}`,
          payload: { clientId: id, addedHashtags: added },
        });
      } catch (slackErr) {
        // The hashtags are already saved — a Slack hiccup must not fail the request.
        console.error("[PUT /api/clients/:id/hashtags] Failed to send Slack notification:", slackErr);
      }
    }

    return NextResponse.json({ ok: true, hashtags: updated?.templateHashtags ?? cleaned });
  } catch (err) {
    console.error("[PUT /api/clients/:id/hashtags]", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
