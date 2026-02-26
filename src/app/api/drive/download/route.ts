export const dynamic = 'force-dynamic';
// src/app/api/drive/download/route.ts
// Generates a presigned S3 download URL for Drive Explorer files.
// Returns the URL as JSON (instead of redirecting) so the client can open it.

import { NextResponse } from 'next/server';
import { generateDownloadUrl } from '@/lib/s3';

export async function POST(req: Request) {
    try {
        const { s3Key, fileName } = await req.json();

        if (!s3Key) {
            return NextResponse.json(
                { error: 'Missing s3Key' },
                { status: 400 }
            );
        }

        const downloadUrl = await generateDownloadUrl(
            s3Key,
            fileName || s3Key.split('/').pop() || 'download'
        );

        return NextResponse.json({ downloadUrl });
    } catch (err: any) {
        console.error('❌ Drive download URL error:', err.message);
        return NextResponse.json(
            { error: 'Failed to generate download URL' },
            { status: 500 }
        );
    }
}
