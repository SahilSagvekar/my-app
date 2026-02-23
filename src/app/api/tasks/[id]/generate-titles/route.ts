// src/app/api/tasks/[id]/generate-titles/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startTitlingJob, getTitlingStatus, retryTitlingJob } from '@/lib/titling-service';
import jwt from 'jsonwebtoken';

function getTokenFromCookies(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/authToken=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * POST /api/tasks/[id]/generate-titles
 * 
 * Trigger title generation for a task
 * Called when QC approves, or manually by scheduler/admin
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = await params;
    
    // 1. Auth check
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
    const { role, userId } = decoded;

    // 2. Role check - only QC, Scheduler, Manager, Admin can trigger
    const allowedRoles = ['qc', 'scheduler', 'manager', 'admin'];
    if (!allowedRoles.includes(role.toLowerCase())) {
      return NextResponse.json(
        { error: `Role '${role}' cannot trigger title generation` },
        { status: 403 }
      );
    }

    // 3. Get task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        files: {
          where: { isActive: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // 4. Check if already processing
    if (task.titlingStatus === 'PROCESSING') {
      const status = await getTitlingStatus(taskId);
      return NextResponse.json({
        success: true,
        message: 'Titling already in progress',
        status: status?.titlingJob,
      });
    }

    // 5. Check if already completed
    if (task.titlingStatus === 'COMPLETED' && task.suggestedTitles) {
      // Allow force regeneration via query param
      const url = new URL(req.url);
      const force = url.searchParams.get('force') === 'true';
      
      if (!force) {
        return NextResponse.json({
          success: true,
          message: 'Titles already generated',
          titles: task.suggestedTitles,
          transcript: task.transcript?.slice(0, 500) + '...',
        });
      }
    }

    // 6. Check for video file
    const videoFile = task.files.find(f => f.mimeType?.startsWith('video/'));
    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file found for this task' },
        { status: 400 }
      );
    }

    // 7. Parse optional body params
    let platform = 'youtube';
    try {
      const body = await req.json();
      if (body.platform) platform = body.platform;
    } catch {
      // No body or invalid JSON, use defaults
    }

    // 8. Update task platform if provided
    if (platform !== task.platform) {
      await prisma.task.update({
        where: { id: taskId },
        data: { platform },
      });
    }

    // 9. Start titling job
    console.log(`\n🚀 Triggering title generation for task: ${taskId}`);
    console.log(`   Triggered by: ${role} (user ${userId})`);
    console.log(`   Platform: ${platform}`);

    const { jobId, transcriptId } = await startTitlingJob(taskId);

    return NextResponse.json({
      success: true,
      message: 'Title generation started',
      jobId,
      transcriptId,
      taskId,
    });

  } catch (err: any) {
    console.error('❌ Generate titles error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * GET /api/tasks/[id]/generate-titles
 * 
 * Get titling status and results for a task
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id: taskId } = await params;
    
    // Auth check
    const token = getTokenFromCookies(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = await getTitlingStatus(taskId);
    
    if (!status) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({
      taskId,
      titlingStatus: status.titlingStatus,
      error: status.titlingError,
      transcript: status.transcript ? {
        length: status.transcript.length,
        preview: status.transcript.slice(0, 300) + '...',
      } : null,
      summary: status.transcriptSummary,
      titles: status.suggestedTitles,
      job: status.titlingJob,
    });

  } catch (err: any) {
    console.error('❌ Get titling status error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
