import { NextRequest, NextResponse } from 'next/server';
import { optimizeVideo } from '@/lib/video-optimizer';
import { getCurrentUser2 } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser2(request);
    if (!user || (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'qc')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = params.id;
    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // 🔥 TRIGGER BACKGROUND OPTIMIZATION
    // We don't await this so it doesn't block the response and cause timeouts
    await prisma.file.update({
      where: { id: fileId },
      data: { optimizationStatus: 'PENDING' }
    });

    optimizeVideo(fileId).catch(err => {
      console.error(`❌ Manual background optimization failed for ${fileId}:`, err);
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Optimization started in the background' 
    }, { status: 202 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
