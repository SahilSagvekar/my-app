// GET /api/files/drive-proxy?fileId=DRIVE_FILE_ID
// Proxies a Google Drive video through the server so the browser can play it
// as a normal <video src> with full range request support

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getDriveProxyStream } from '@/lib/file-server';

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

    const range = request.headers.get('range') || undefined;
    const fsRes = await getDriveProxyStream(0, 'admin', fileId, range);

    if (!fsRes.ok && fsRes.status !== 206) {
      return new NextResponse('Failed to fetch from Drive', { status: fsRes.status });
    }

    const headers = new Headers();
    const ct = fsRes.headers.get('content-type');
    const cl = fsRes.headers.get('content-length');
    const cr = fsRes.headers.get('content-range');

    headers.set('Content-Type', ct?.startsWith('video/') ? ct : 'video/mp4');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'public, max-age=3600');
    if (cl) headers.set('Content-Length', cl);
    if (cr) headers.set('Content-Range', cr);

    return new NextResponse(fsRes.body, {
      status: range ? 206 : 200,
      headers,
    });
  } catch (error: any) {
    console.error('Drive proxy error:', error?.message);
    return new NextResponse('Stream failed', { status: 500 });
  }
}