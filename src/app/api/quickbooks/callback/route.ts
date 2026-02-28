import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCodeForTokens } from "@/lib/quickbooks";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (
        !session?.user?.role ||
        !["admin", "manager"].includes(session.user.role)
    ) {
        // Redirect to dashboard with error
        return NextResponse.redirect(
            new URL("/dashboard?qb_error=unauthorized", req.url)
        );
    }

    try {
        const result = await exchangeCodeForTokens(
            req.url,
            parseInt(session.user.id as string)
        );

        // Redirect to dashboard with success
        const redirectUrl = new URL("/dashboard", req.url);
        redirectUrl.searchParams.set("qb_connected", "true");
        if (result.companyName) {
            redirectUrl.searchParams.set("qb_company", result.companyName);
        }
        return NextResponse.redirect(redirectUrl);
    } catch (err: any) {
        console.error("[QuickBooks Callback] Error:", err);
        return NextResponse.redirect(
            new URL(
                `/dashboard?qb_error=${encodeURIComponent(err.message || "Connection failed")}`,
                req.url
            )
        );
    }
}
