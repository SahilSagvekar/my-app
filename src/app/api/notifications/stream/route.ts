import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { addClient } from "@/lib/notifications-bus";

export const dynamic = "force-dynamic";

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

export async function GET(req: Request) {
    const token = getTokenFromCookies(req);
    if (!token) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        const userId = Number(decoded.userId);
        const clientKey = `${userId}:${Date.now()}`;

        const stream = new ReadableStream({
            start(controller) {
                const send = (data: string) => {
                    controller.enqueue(new TextEncoder().encode(data));
                };

                addClient(clientKey, send);

                // Send initial heartbeat
                send(`: heartbeat\n\n`);

                req.signal.addEventListener("abort", () => {
                    // Note: In some environments removeClient might need to be called here
                    // but our current bus is simple. 
                });
            },
            cancel() {
                // Bus cleanup would happen here in a more robust implementation
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        });
    } catch (err) {
        return new Response("Unauthorized", { status: 401 });
    }
}
