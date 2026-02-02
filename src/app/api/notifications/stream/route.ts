import { getCurrentUser2 } from "@/lib/auth";
import { addClient } from "@/lib/notifications-bus";

export const dynamic = "force-dynamic";

export async function GET(req: any) {
    const user = await getCurrentUser2(req);
    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const userId = user.id;
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
