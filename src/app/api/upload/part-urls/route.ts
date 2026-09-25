export const dynamic = 'force-dynamic';
// src/app/api/upload/part-urls/route.ts
// Batched version of /api/upload/part-url — presigns up to 50 UploadPart URLs
// in one browser round trip. Still delegates each presign to the file server
// (service binding, cheap) — the Worker never signs anything itself.

import { NextRequest, NextResponse } from 'next/server';
import { getPartUrl } from '@/lib/file-server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser2 } from '@/lib/auth';

const MAX_PARTS_PER_REQUEST = 50;

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();

  // 🔒 Same baseline gate as /part-url: login required. The key+uploadId must
  // already have come from an authorized /initiate call, which is where the
  // real task/folderType ownership check lives.
  const currentUser = await getCurrentUser2(request);
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const { key, uploadId, partNumbers, backend } = body || {};

  if (!key || typeof key !== 'string' || !uploadId || typeof uploadId !== 'string' || !Array.isArray(partNumbers)) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!partNumbers.every((n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0)) {
    return NextResponse.json({ error: 'partNumbers must be positive integers' }, { status: 400 });
  }

  const uniqueParts = Array.from(new Set<number>(partNumbers as number[]));
  if (uniqueParts.length < 1 || uniqueParts.length > MAX_PARTS_PER_REQUEST) {
    return NextResponse.json(
      { error: `partNumbers must contain 1–${MAX_PARTS_PER_REQUEST} entries` },
      { status: 400 }
    );
  }

  try {
    const results = await Promise.all(
      uniqueParts.map(async (partNumber) => {
        // `backend` is whatever /api/upload/initiate returned for this
        // upload — echoed back by the client on every batch so all parts
        // of one upload land in the same bucket it started in.
        const { presignedUrl } = await getPartUrl(env, 'system', 'uploader', key, uploadId, partNumber, backend === 'backup' ? 'backup' : 'r2');
        return [partNumber, presignedUrl] as const;
      })
    );

    const urls: Record<number, string> = {};
    for (const [partNumber, url] of results) urls[partNumber] = url;

    return NextResponse.json({ urls });
  } catch (error: any) {
    console.error('❌ Part-URLs proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned URLs', message: error.message },
      { status: 500 }
    );
  }
}