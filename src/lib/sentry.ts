// src/lib/sentry.ts
//
// Thin re-export so route files don't each need to know whether they're
// running in the Worker (server-side) vs the browser — `@sentry/cloudflare`
// re-exports the same core API as `@sentry/nextjs`, so this works from
// either an API route or (if ever needed) a server component.
//
// IMPORTANT — this does NOT automatically forward errors on its own. See
// SENTRY_SETUP.md: the vast majority of this codebase's API routes already
// catch their own errors (try/catch → console.error → NextResponse.json
// 500), and Sentry.withSentry() in worker.ts only auto-captures exceptions
// that escape ALL the way to the top of the Worker's fetch handler — which
// an already-caught error never does. To actually get a route's errors into
// Sentry, call captureError(err) inside its catch block. Not done
// automatically/retroactively across all 270+ routes in this pass — add it
// route-by-route as you touch them, starting with the ones you actually
// want paged for (payments, auth, webhooks).
//
// Example:
//   } catch (err) {
//     console.error('[my-route]', err);
//     captureError(err, { route: 'my-route' });
//     return NextResponse.json({ message: 'Server error' }, { status: 500 });
//   }

import * as Sentry from '@sentry/cloudflare';

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch (sentryErr) {
    // Never let Sentry itself be the reason a request fails.
    console.warn('[sentry] captureException failed:', sentryErr);
  }
}