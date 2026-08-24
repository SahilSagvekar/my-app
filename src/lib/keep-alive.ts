// src/lib/keep-alive.ts
//
// Wraps a fire-and-forget promise with ctx.waitUntil() so it survives past
// the point where the HTTP response is sent. Without this, Cloudflare is
// free to kill any "unawaited" async work (Slack/email dispatch, etc.) the
// instant the response goes out — often before it's even reached the point
// of actually sending anything, with no error logged. Must be called
// synchronously, before any `await`, while the request's context is still
// guaranteed valid — see notify.ts and drive/upload/route.ts for usage.

import { getCloudflareContext } from '@opennextjs/cloudflare';

export function keepAlive(promise: Promise<any>) {
  try {
    const { ctx } = getCloudflareContext();
    ctx?.waitUntil(promise);
  } catch (err: any) {
    // No Workers context (e.g. local `next dev`) — nothing to register
    // with, the promise just runs best-effort as before.
  }
}