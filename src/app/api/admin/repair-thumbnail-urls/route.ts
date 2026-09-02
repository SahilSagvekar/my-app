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
// This route does the same resolution server-side (where the env var is
// actually available) and 302-redirects to the real URL — so client code
// can just point an <img src> here instead of calling getFileUrl() itself.

import { NextRequest, NextResponse } from 'next/server';
import { getFileUrl } from '@/lib/s3';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'key is required' }, { status: 400 });
  }
  const url = getFileUrl(key);
  return NextResponse.redirect(url, { status: 302 });
}