// src/instrumentation-client.ts
//
// Next.js 15's built-in convention for client-side instrumentation — this
// file is auto-loaded before the app renders in the browser, no import
// needed anywhere else. See: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
//
// Deliberately just calls Sentry.init() here — NOT wrapping next.config.ts
// in withSentryConfig(). That wrapper adds automatic source-map upload and
// server-side route instrumentation, both built around a Node.js server
// runtime this app doesn't have on Cloudflare Workers (see worker.ts for the
// server/API-route half of Sentry, which uses @sentry/cloudflare instead).
// Skipping it means client stack traces won't be de-minified automatically
// — a possible follow-up once this is confirmed working — but error
// capture, breadcrumbs, and user context all work fine without it.
//
// NEXT_PUBLIC_SENTRY_DSN must be set at BUILD time (it's inlined into the
// client bundle, same as any NEXT_PUBLIC_* var) — see SENTRY_SETUP.md.
// Sentry.init() with an empty/undefined dsn is a documented no-op, so this
// is safe to ship before the env var is set.

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",
  tracesSampleRate: 0.1,
  // Session replay is a paid-tier feature on most Sentry plans and adds
  // meaningful bundle size — left off by default. Bump these above 0 (and
  // add Sentry.replayIntegration() to `integrations`) if you want it later.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});