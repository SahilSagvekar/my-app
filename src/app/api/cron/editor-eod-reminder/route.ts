// FILE: src/app/api/cron/editor-eod-reminder/route.ts
// Weekday 6:00 PM America/New_York — reminds editors in the e8-editor-updates
// Slack channel (the "editors" channel group in src/lib/slack.ts) to send
// their EOD report before the day ends.
//
// Cloudflare Cron Triggers are UTC-only, so worker.ts fires this route at BOTH
// 22:00 UTC (6 PM EDT) and 23:00 UTC (6 PM EST). The ET-hour guard below makes
// only the one that lands on 6 PM Eastern actually post, so it is exact all
// year round and never posts twice.

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { sendToChannel } from "@/lib/slack";
import { EST_TZ } from "@/lib/est-date";

const REMINDER_HOUR_ET = 18;

const MESSAGE = [
  "<!channel>",
  ":clipboard: *EOD report reminder*",
  "Please send your EOD report in the E8 App before the end of the day. Thank you!",
].join("\n");

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }

  const cookieHeader = req.headers.get("cookie");
  const match = cookieHeader?.match(/authToken=([^;]+)/);
  const token = match ? match[1] : null;
  if (!token) return false;

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    return decoded.role?.toLowerCase() === "admin";
  } catch {
    return false;
  }
}

function isEnabled(): boolean {
  const raw = process.env.SLACK_EDITOR_EOD_REMINDER_ENABLED?.trim().toLowerCase();
  if (raw && ["0", "false", "no", "off", "disabled"].includes(raw)) return false;
  const global = process.env.SLACK_SCHEDULED_NOTIFICATIONS_ENABLED?.trim().toLowerCase();
  if (global && ["0", "false", "no", "off", "disabled"].includes(global)) return false;
  return true;
}

// Current hour (0-23) and weekday (Mon..Sun) in Eastern time.
function getEasternNow(now: Date): { hour: number; weekday: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EST_TZ,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // Some runtimes render midnight as "24".
  return { hour: parseInt(get("hour"), 10) % 24, weekday: get("weekday") };
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!isEnabled()) {
      return NextResponse.json({ ok: true, skipped: true, reason: "disabled by env" });
    }

    // ?force=1 lets an admin fire it manually to test the webhook.
    const force = new URL(req.url).searchParams.get("force") === "1";
    const { hour, weekday } = getEasternNow(new Date());

    if (!force) {
      if (hour !== REMINDER_HOUR_ET) {
        return NextResponse.json({ ok: true, skipped: true, reason: `ET hour is ${hour}, not ${REMINDER_HOUR_ET}` });
      }
      if (weekday === "Sat" || weekday === "Sun") {
        return NextResponse.json({ ok: true, skipped: true, reason: "weekend" });
      }
    }

    const delivery = await sendToChannel("editors", {
      type: "scheduled_reminder",
      title: "Editor EOD Report Reminder",
      message: MESSAGE,
      payload: { scheduledJobKey: "editor_eod_report_reminder", scheduledTimezone: EST_TZ },
    });

    if (delivery.missing) {
      console.error("❌ /api/cron/editor-eod-reminder: no webhook configured for the editors channel");
    }

    return NextResponse.json({ ok: true, delivery });
  } catch (err: any) {
    console.error("❌ /api/cron/editor-eod-reminder error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
