import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuthorizationUrl } from "@/lib/quickbooks";

export async function GET() {
    const session = await auth();
    if (
        !session?.user?.role ||
        !["admin", "manager"].includes(session.user.role)
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authUrl = getAuthorizationUrl();
    return NextResponse.redirect(authUrl);
}
