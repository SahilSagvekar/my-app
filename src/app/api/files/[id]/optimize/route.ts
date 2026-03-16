import { NextRequest, NextResponse } from 'next/server';
import { optimizeVideo } from '@/lib/video-optimizer';
import { getCurrentUser2 } from '@/lib/auth';

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

    // This is an async operation that can take a while
    // In a real production app, this would be a background job (worker)
    // For now, we run it and wait (or return early if needed)
    console.log(`🚀 Triggering manual optimization for file: ${fileId}`);
    
    // We run it and let the user know it started
    // If we want to wait for it, we await optimizeVideo
    const result = await optimizeVideo(fileId);

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Video optimized successfully',
        url: result.url 
      });
    } else {
      return NextResponse.json({ 
        error: 'Optimization failed', 
        details: result.error 
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
