export const dynamic = 'force-dynamic';
// src/app/api/upload/abort/route.ts
// Thin proxy — delegates AbortMultipartUpload to file server

import { NextRequest, NextResponse } from 'next/server';
import { abortMultipart } from '@/lib/file-server';

export async function POST(request: NextRequest) {
  try {
    const { key, uploadId } = await request.json();
    if (!key || !uploadId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    await abortMultipart('system', 'uploader', key, uploadId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error aborting upload:', error);
    return NextResponse.json(
      { error: 'Failed to abort upload', message: error.message },
      { status: 500 }
    );
  }
}