export const dynamic = 'force-dynamic';
// src/app/api/drive/search/route.ts
// Global deep search across all S3/R2 folders

import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getDbHttp } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateSignedUrl, getS3, BUCKET } from '@/lib/s3';
import { searchFiles } from '@/lib/file-server';

const s3Client = getS3();

export async function GET(request: NextRequest) {
  const db = getDbHttp();
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase().trim();
    const role = searchParams.get('role') || 'admin';
    const userId = searchParams.get('userId') || '0';
    const max = parseInt(searchParams.get('max') || '50');

    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 });
    }

    let prefix = '';
    if (role === 'client' && userId) {
      const foundUser = await db.query.user.findFirst({
        where: eq(userTable.id, parseInt(userId)),
        with: { client: { columns: { companyName: true, name: true } } },
      });
      if (foundUser?.client) {
        const company = foundUser.client.companyName || foundUser.client.name;
        prefix = `${company}/`;
      }
    }

    const result = await searchFiles(userId, role, query, prefix, max);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Search failed', details: error.message }, { status: 500 });
  }
}