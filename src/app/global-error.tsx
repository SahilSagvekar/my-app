"use client";

// src/app/global-error.tsx
//
// Next.js's root-level error boundary — catches rendering errors that
// escape every other error.tsx (including one in the root layout itself)
// and reports them to Sentry. Next.js requires this to render its own
// <html>/<body> since it fully replaces the root layout when it triggers.
// See: https://nextjs.org/docs/app/api-reference/file-conventions/error#global-errorjs

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: 16 }}>
            The error's been reported. Try again, or refresh the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}