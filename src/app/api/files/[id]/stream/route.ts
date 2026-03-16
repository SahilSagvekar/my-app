import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getS3, BUCKET } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getCurrentUser2 } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const fileId = params.id;
        
        // 1. Auth check
        const user = await getCurrentUser2(request);
        if (!user) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 2. Get file details
        const file = await prisma.file.findUnique({
            where: { id: fileId },
        });

        if (!file || !file.s3Key) {
            return new NextResponse('File not found', { status: 404 });
        }

        // 3. Handle Range Requests (Crucial for video scrubbing/streaming)
        const range = request.headers.get('range');
        const s3Client = getS3();

        const getObjectParams: any = {
            Bucket: BUCKET,
            Key: file.s3Key,
        };

        if (range) {
            getObjectParams.Range = range;
        }

        const data = await s3Client.send(new GetObjectCommand(getObjectParams));

        if (!data.Body) {
            return new NextResponse('Could not fetch file from storage', { status: 500 });
        }

        // 4. Build Response Headers
        const headers = new Headers();
        headers.set('Content-Type', file.mimeType || 'video/mp4');
        headers.set('Accept-Ranges', 'bytes');
        
        if (data.ContentLength) {
            headers.set('Content-Length', data.ContentLength.toString());
        }
        
        if (data.ContentRange) {
            headers.set('Content-Range', data.ContentRange);
        }

        // Cache headers to allow browser buffering
        headers.set('Cache-Control', 'public, max-age=3600');

        // 5. Return stream
        const status = range ? 206 : 200;
        return new NextResponse(data.Body as any, {
            status,
            headers,
        });

    } catch (error: any) {
        console.error('Streaming error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
