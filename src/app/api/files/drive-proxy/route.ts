// GET /api/files/drive-proxy?fileId=DRIVE_FILE_ID
// Proxies a Google Drive video through the server so the browser can play it
// as a normal <video src> with full range request support

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

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

    const accessToken = await getAccessToken();
    const range = request.headers.get('range');

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const fetchHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (range) fetchHeaders['Range'] = range;

    const driveRes = await fetch(driveUrl, { headers: fetchHeaders });

    if (!driveRes.ok && driveRes.status !== 206) {
      console.error(`Drive proxy fetch failed: ${driveRes.status}`);
      return new NextResponse('Failed to fetch from Drive', { status: driveRes.status });
    }

    const headers = new Headers();
    const ct = driveRes.headers.get('content-type');
    const cl = driveRes.headers.get('content-length');
    const cr = driveRes.headers.get('content-range');

    headers.set('Content-Type', (ct && ct.startsWith('video/')) ? ct : 'video/mp4');
    if (cl) headers.set('Content-Length', cl);
    if (cr) headers.set('Content-Range', cr);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');

    console.log(`🎬 Drive proxy | fileId: ${fileId} | status: ${driveRes.status} | content-type: ${ct} | content-length: ${cl}`);

    return new NextResponse(driveRes.body, {
      status: range ? 206 : 200,
      headers,
    });

  } catch (error: any) {
    console.error('Drive proxy error:', error?.message || error);
    return new NextResponse('Failed to stream from Drive', { status: 500 });
  }
}