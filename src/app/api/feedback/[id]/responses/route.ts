// app/api/feedback/[id]/responses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';

// POST - Add response to feedback
export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const currentUser = getUserFromToken(req);
    
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { params } = await Promise.resolve(context);
    const feedbackId = params.id;
    const body = await req.json();
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!body.message) {
      return NextResponse.json(
        { ok: false, message: 'Message is required' },
        { status: 400 }
      );
    }

    // Check if feedback exists
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      include: {
        sender: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!feedback) {
      return NextResponse.json(
        { ok: false, message: 'Feedback not found' },
        { status: 404 }
      );
    }

    // Only admin/manager can respond
    if (!['admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json(
        { ok: false, message: 'Only admins and managers can respond to feedback' },
        { status: 403 }
      );
    }

    // Create response
    const response = await prisma.feedbackResponse.create({
      data: {
        message: body.message,
        feedbackId: feedbackId,
        senderId: currentUser.userId
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true
          }
        }
      }
    });

    // Auto-update status to acknowledged if still pending
    if (feedback.status === 'PENDING') {
      await prisma.feedback.update({
        where: { id: feedbackId },
        data: { status: 'ACKNOWLEDGED' }
      });
    }

    // Create audit log
    await createAuditLog({
      userId: currentUser.userId,
      action: AuditAction.FEEDBACK_RESPONDED,
      entity: 'FeedbackResponse',
      entityId: response.id,
      details: `Responded to feedback: ${feedback.subject}`,
      metadata: {
        feedbackId: feedback.id,
        responseLength: body.message.length
      },
      ipAddress,
      userAgent
    });

    // TODO: Emit Socket.io event to feedback sender
    // io.to(`user-${feedback.senderId}`).emit('feedback-response', { ... });

    return NextResponse.json({
      ok: true,
      response: {
        id: response.id,
        message: response.message,
        sender: {
          id: response.sender.id.toString(),
          name: response.sender.name || 'Unknown',
          role: response.sender.role || 'user'
        },
        createdAt: response.createdAt.toISOString()
      },
      message: 'Response added successfully'
    });

  } catch (error: any) {
    console.error('Error creating response:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}