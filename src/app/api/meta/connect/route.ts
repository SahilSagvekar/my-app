export const dynamic = 'force-dynamic';
// src/app/api/meta/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser2 } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser2(req);
        if (!user || (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'client')) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const appId = process.env.META_APP_ID;
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/callback`;
        const scopes = [
            "instagram_basic",
            "instagram_manage_insights",
            "pages_show_list",
            "pages_read_engagement",
            "public_profile"
        ].join(",");

        const { searchParams } = new URL(req.url);
        const clientIdParam = searchParams.get("clientId");
        const state = clientIdParam || "self";

        const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error("Meta Connect Error:", error);
        return NextResponse.json({ error: "Failed to initiate Meta connection" }, { status: 500 });
    }
}
