export const dynamic = 'force-dynamic';
// src/app/api/drive/search/route.ts
// Global deep search across all S3/R2 folders

import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { generateSignedUrl, getS3, BUCKET } from '@/lib/s3';
import { searchFiles } from '@/lib/file-server';

const s3Client = getS3();

export async function GET(request: NextRequest) {
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
      const user = await prisma.user.findUnique({
        where: { id: parseInt(userId) },
        select: { linkedClient: { select: { companyName: true, name: true } } },
      });
      if (user?.linkedClient) {
        const company = user.linkedClient.companyName || user.linkedClient.name;
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