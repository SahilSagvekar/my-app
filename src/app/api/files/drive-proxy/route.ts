// GET /api/files/drive-proxy?fileId=DRIVE_FILE_ID
// Proxies a Google Drive video through the server so the browser can play it
// as a normal <video src> with full range request support

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getAccessToken(): Promise<string> {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const tokens = await auth.authorize();
  return tokens.access_token!;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return new NextResponse('Invalid fileId', { status: 400 });
    }

    const range = request.headers.get('range') || undefined;
    const accessToken = await getAccessToken();
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(range ? { Range: range } : {}),
        },
      },
    );

    if (!driveRes.ok && driveRes.status !== 206) {
      const body = await driveRes.text().catch(() => '');
      console.error('Drive proxy upstream error:', driveRes.status, body.slice(0, 500));
      return new NextResponse('Failed to fetch from Drive', { status: driveRes.status });
    }

    if (!driveRes.body) {
      return new NextResponse('Drive response was empty', { status: 502 });
    }

    const headers = new Headers();
    const ct = driveRes.headers.get('content-type');
    const cl = driveRes.headers.get('content-length');
    const cr = driveRes.headers.get('content-range');

    headers.set('Content-Type', ct?.startsWith('video/') ? ct : 'video/mp4');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');
    if (cl) headers.set('Content-Length', cl);
    if (cr) headers.set('Content-Range', cr);

    return new NextResponse(driveRes.body, {
      status: driveRes.status === 206 ? 206 : 200,
      headers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Drive proxy error:', message);
    return new NextResponse('Stream failed', { status: 500 });
  }
}
