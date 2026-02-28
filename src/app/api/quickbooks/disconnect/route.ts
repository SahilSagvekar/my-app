import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { disconnectQuickBooks } from "@/lib/quickbooks";

export async function POST() {
    const session = await auth();
    if (
        !session?.user?.role ||
        !["admin", "manager"].includes(session.user.role)
    ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await disconnectQuickBooks();
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[QuickBooks Disconnect] Error:", err);
        return NextResponse.json(
            { error: err.message || "Disconnect failed" },
            { status: 500 }
        );
    }
}
