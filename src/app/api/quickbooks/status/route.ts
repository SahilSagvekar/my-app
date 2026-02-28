import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getActiveConnection } from "@/lib/quickbooks";

export async function GET() {
    const session = await auth();
    if (!session?.user?.role) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await getActiveConnection();

    return NextResponse.json({
        connected: !!connection,
        companyName: connection?.companyName || null,
        connectedAt: connection?.createdAt || null,
    });
}
