import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

function getTokenFromCookies(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    return match ? match[1] : null;
}

// POST /api/drive/share - Generate a shareable link for an S3 file
export async function POST(req: NextRequest) {
    try {
        const token = getTokenFromCookies(req);
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { s3Key, fileName, fileSize, mimeType } = body;

        if (!s3Key) {
            return NextResponse.json({ error: 'S3 Key is required' }, { status: 400 });
        }

        // Generate a unique share token
        const shareToken = randomBytes(24).toString('hex');

        // Create the shareable file record (Never expires by default)
        const shareableFile = await prisma.shareableFile.create({
            data: {
                s3Key,
                fileName: fileName || s3Key.split('/').pop() || 'file',
                fileSize: fileSize ? BigInt(fileSize) : null,
                mimeType,
                shareToken,
                createdBy: Number(decoded.userId),
                isActive: true,
                expiresAt: null, // Never expires
            }
        });

        // Generate the shareable URL
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';
        const shareUrl = `${baseUrl}/shared/file/${shareToken}`;

        return NextResponse.json({
            success: true,
            shareUrl,
            shareToken,
            message: 'Share link generated successfully'
        });

    } catch (error: any) {
        console.error('Error in POST /api/drive/share:', error);
        return NextResponse.json(
            { error: 'Failed to generate share link', details: error.message },
            { status: 500 }
        );
    }
}
