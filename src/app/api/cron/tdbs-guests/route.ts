import { NextResponse } from "next/server";
import { sendToChannel } from "@/lib/slack";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Basic verification - typically Vercel crons send a specific header
    // if (req.headers.get("Authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    //   return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    // }

    console.log("[Cron] Sending TDBS Guests placeholder notification...");

    await sendToChannel("tdbs_guests", {
      type: "tdbs_guests_placeholder",
      title: "🎉 Guest Notification",
      body: "This is a placeholder message for the TDBS Guests channel. Please update the content and schedule in the codebase.",
    });

    return NextResponse.json({ success: true, message: "TDBS Guests notification sent" }, { status: 200 });
  } catch (error: any) {
    console.error("[Cron] Error sending TDBS Guests notification:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
