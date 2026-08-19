// Custom Worker entrypoint — wraps the OpenNext-generated handler to add a
// scheduled() cron handler. cron-master.ts (node-cron + setInterval) can't
// run on Workers — no persistent process — so the daily/weekly billing jobs
// it used to fire are dispatched from here instead, on Cloudflare Cron
// Triggers (see wrangler.toml [triggers]).
//
// Cron Triggers always fire in UTC (no per-job timezone support like
// node-cron had) — times below are converted from the job's original
// America/New_York schedule using EDT (UTC-4). During EST months
// (~early Nov - mid Mar) each job will fire ~1 hour later ET than intended.
// If that drift matters, bump the UTC hour by 1 for the winter half of the year.
//
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

const BASE_URL = "https://e8productions.com";

async function triggerCronRoute(
  path: string,
  method: "GET" | "POST",
  authHeader: Record<string, string>,
  env: Record<string, string>,
) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...authHeader },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[Cron] ${path} failed (${res.status}): ${text}`);
    } else {
      console.log(`[Cron] ${path} succeeded: ${text}`);
    }
  } catch (err: any) {
    console.error(`[Cron] ${path} threw:`, err?.message || err);
  }
}

export default {
  fetch: handler.fetch,

  async scheduled(event, env, ctx) {
    const cronSecret = env.CRON_SECRET || "";
    const xCronSecret = { "x-cron-secret": cronSecret };
    const bearer = { authorization: `Bearer ${cronSecret}` };

    // NOTE (2026-08-19): auto-invoice, commission-payouts, and
    // commission-payouts-reconcile are paused — their cron strings are
    // commented out in wrangler.toml's [triggers], so event.cron will never
    // match those cases below. Logic is kept as-is; re-enable by uncommenting
    // the matching line in wrangler.toml.
    switch (event.cron) {
      // Auto-Invoice Generation — daily 9:00 AM ET (PAUSED)
      case "0 13 * * *":
        ctx.waitUntil(triggerCronRoute("/api/cron/auto-invoice", "POST", xCronSecret, env));
        break;

      // Enforce Portal Locks — daily 9:15 AM ET (runs after auto-invoice)
      case "15 13 * * *":
        ctx.waitUntil(triggerCronRoute("/api/cron/enforce-portal-locks", "POST", xCronSecret, env));
        break;

      // Commission Payout Batch — Fridays 5:00 PM ET (PAUSED)
      case "0 21 * * 5":
        ctx.waitUntil(triggerCronRoute("/api/cron/commission-payouts", "POST", bearer, env));
        break;

      // Commission Payout Reconciliation — every 2 hours (PAUSED)
      case "0 */2 * * *":
        ctx.waitUntil(triggerCronRoute("/api/cron/commission-payouts-reconcile", "POST", bearer, env));
        break;

      default:
        console.log("[Cron] Unhandled schedule:", event.cron);
    }
  },
} satisfies ExportedHandler<CloudflareEnv>;

// Required for DO Queue and DO Tag Cache
// @ts-ignore
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
