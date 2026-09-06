export const dynamic = 'force-dynamic';
// src/app/api/thumbnail-url/route.ts
//
// QCDashboard.tsx, ClientDashboard.tsx, and ClientTaskCard.tsx all call
// getFileUrl() directly in client-side code as an optimistic fallback —
// showing a task's auto-generated thumbnail from its known R2 key pattern
// before a File DB row necessarily exists yet. But getFileUrl() reads
// process.env.R2_PUBLIC_URL, which is server-only: Next.js never exposes
// plain (non-NEXT_PUBLIC_) env vars to browser code, so calling it
// client-side always fell through to the broken amazonaws.com/undefined
// fallback, no matter what the server-side value is.
//
// This route does the equivalent resolution server-side and 302-redirects
// to the real URL — so client code can just point an <img src> here.
//
// The bucket is NOT publicly readable (no working R2_PUBLIC_URL/custom
// domain), so getFileUrl() alone returns an unsigned r2.cloudflarestorage.com
// placeholder that R2 rejects outright — its own docstring says as much
// ("may not be accessible without signing"). Use generateSignedUrl() to
// actually produce a working presigned GET URL, same as the file-download
// and video-stream routes already do.

import { NextRequest, NextResponse } from 'next/server';
import { generateSignedUrl } from '@/lib/s3';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }
  try {
    const url = await generateSignedUrl(key);
    return NextResponse.redirect(url, { status: 302 });
  } catch (err) {
    console.error('[thumbnail-url] Failed to sign URL for key:', key, err);
    return NextResponse.json({ error: 'Failed to resolve thumbnail URL' }, { status: 500 });
  }
}