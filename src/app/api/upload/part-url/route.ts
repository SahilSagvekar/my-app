export const dynamic = 'force-dynamic';
// src/app/api/upload/part-url/route.ts
// Thin proxy — delegates UploadPart presigning to file server

import { NextRequest, NextResponse } from 'next/server';
import { getPartUrl } from '@/lib/file-server';

export async function POST(request: NextRequest) {
  let body: any;
  try {
    const rawBody = await request.text();
    if (!rawBody || rawBody.trim() === '') {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }
    body = JSON.parse(rawBody);
  } catch (e: any) {
    return NextResponse.json({ error: 'Invalid JSON body', details: e.message }, { status: 400 });
  }

  const { key, uploadId, partNumber } = body;

  if (!key || !uploadId || !partNumber) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const { presignedUrl } = await getPartUrl('system', 'uploader', key, uploadId, partNumber);
    return NextResponse.json({ presignedUrl });
  } catch (error: any) {
    console.error('❌ Part-URL proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URL', message: error.message },
      { status: 500 }
    );
  }
}