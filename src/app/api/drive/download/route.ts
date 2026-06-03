export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { presignDownload } from '@/lib/file-server';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { s3Key, fileName } = await req.json();
    if (!s3Key) return NextResponse.json({ error: 'Missing s3Key' }, { status: 400 });

    const { downloadUrl } = await presignDownload(user.id, user.role, s3Key, fileName);
    return NextResponse.json({ downloadUrl });
  } catch (err: any) {
    console.error('Drive download error:', err);
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }
}