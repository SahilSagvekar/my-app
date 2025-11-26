import { addClient, removeClient } from "@/lib/notifications-bus";
import { getUserFromRequest } from "@/lib/auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = getUserFromRequest(req);
  if (!user || !user.userId)
    return new Response("Unauthorized", { status: 401 });

  const id = randomUUID();
  const userId = user.userId;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          removeClient(`${userId}:${id}`);
        }
      };

      // Register specific user client
      addClient(`${userId}:${id}`, send);

      const keepAlive = setInterval(() => {
        send(": keep-alive\n\n");
      }, 20000);

      controller.signal?.addEventListener("abort", () => {
        clearInterval(keepAlive);
        removeClient(`${userId}:${id}`);
      });
    },

    cancel() {
      removeClient(`${userId}:${id}`);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
