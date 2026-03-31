// POST /api/compression/control - Control compression system
import { NextRequest, NextResponse } from 'next/server';
import { forceStartSpot, forceStopSpot, startWorker, stopWorker } from '@/lib/video-compression';
import jwt from 'jsonwebtoken';

function getUserFromToken(req: Request): { userId: number; role: string } | null {
  try {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) return null;
    const match = cookieHeader.match(/authToken=([^;]+)/);
    if (!match) return null;
    const decoded: any = jwt.verify(match[1], process.env.JWT_SECRET!);
    return { userId: decoded.userId, role: decoded.role };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Only admin can control compression system
    if (user.role.toLowerCase() !== 'admin') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'start-spot': {
        const result = await forceStartSpot();
        return NextResponse.json({
          success: result.success,
          message: result.success ? 'Spot instance starting' : result.error,
        });
      }

      case 'stop-spot': {
        await forceStopSpot();
        return NextResponse.json({
          success: true,
          message: 'Spot instance stopping',
        });
      }

      case 'start-worker': {
        // Start worker in background (non-blocking)
        startWorker().catch(console.error);
        return NextResponse.json({
          success: true,
          message: 'Worker starting',
        });
      }

      case 'stop-worker': {
        stopWorker();
        return NextResponse.json({
          success: true,
          message: 'Worker stopping',
        });
      }

      default:
        return NextResponse.json(
          { message: 'Invalid action. Use: start-spot, stop-spot, start-worker, stop-worker' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('POST /api/compression/control error:', error);
    return NextResponse.json(
      { message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}