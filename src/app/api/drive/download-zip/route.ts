export const dynamic = 'force-dynamic';
// POST /api/drive/download-zip
// Issues a short-lived zip token from the file server and returns the direct
// download URL. The browser then hits the file server directly — bypassing
// Next.js entirely for the actual zip stream (Next.js can't stream large
// binary responses without buffering/timeout issues).

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { issueZipToken } from '@/lib/file-server';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { keys, folderPrefix, zipName } = body;

    if (!keys?.length && !folderPrefix) {
      return NextResponse.json({ error: 'Provide keys[] or folderPrefix' }, { status: 400 });
    }

    const { url } = await issueZipToken(user.id, user.role, { keys, folderPrefix, zipName });
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('download-zip error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create zip' }, { status: 500 });
  }
}