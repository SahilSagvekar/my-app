import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getCurrentUser2 } from "@/lib/auth";
import { getThumbnailStats, getThumbnailFailed } from "@/lib/file-server";

// GET /api/admin/thumbnail-stats
//
// Proxies e8-file-server's /thumbnail/stats (and /thumbnail/failed, when
// ?failed=1 is passed) through the FILE_SERVER service binding — the file
// server itself isn't publicly reachable anymore (see the 1042 fix in
// /areas/cloudflare-migration.md), so this is the only way to check real
// queue counts from outside.
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user || !["admin", "manager"].includes(user.role?.toLowerCase() || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { env } = getCloudflareContext();
    const wantFailed = req.nextUrl.searchParams.get("failed") === "1";

    const stats = await getThumbnailStats(env);
    const failed = wantFailed ? await getThumbnailFailed(env) : undefined;

    return NextResponse.json({ ok: true, stats, failed });
  } catch (err: any) {
    console.error("Thumbnail stats error:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch thumbnail stats" }, { status: 502 });
  }
}