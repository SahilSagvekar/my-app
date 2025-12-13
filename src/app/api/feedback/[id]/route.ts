// app/api/feedback/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';

// GET - Get single feedback
export async function GET(
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

    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        responses: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
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

    // Check access
    if (!['admin', 'manager'].includes(currentUser.role) && feedback.senderId !== currentUser.userId) {
      return NextResponse.json(
        { ok: false, message: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      feedback: {
        id: feedback.id,
        subject: feedback.subject,
        message: feedback.message,
        category: feedback.category.toLowerCase(),
        priority: feedback.priority.toLowerCase(),
        status: feedback.status.toLowerCase().replace('_', '-'),
        sender: {
          id: feedback.sender.id.toString(),
          name: feedback.sender.name || 'Unknown',
          role: feedback.sender.role || 'user'
        },
        createdAt: feedback.createdAt.toISOString(),
        responses: feedback.responses.map(resp => ({
          id: resp.id,
          message: resp.message,
          sender: {
            id: resp.sender.id.toString(),
            name: resp.sender.name || 'Unknown',
            role: resp.sender.role || 'user'
          },
          createdAt: resp.createdAt.toISOString()
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH - Update feedback status
export async function PATCH(
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

    // Only admin/manager can update status
    if (!['admin', 'manager'].includes(currentUser.role)) {
      return NextResponse.json(
        { ok: false, message: 'Only admins and managers can update feedback status' },
        { status: 403 }
      );
    }

    const { params } = await Promise.resolve(context);
    const feedbackId = params.id;
    const body = await req.json();
    const { ipAddress, userAgent } = getRequestMetadata(req);

    if (!body.status) {
      return NextResponse.json(
        { ok: false, message: 'Status is required' },
        { status: 400 }
      );
    }

    // Map status
    const statusMap: { [key: string]: string } = {
      'pending': 'PENDING',
      'acknowledged': 'ACKNOWLEDGED',
      'in-progress': 'IN_PROGRESS',
      'resolved': 'RESOLVED'
    };

    const feedback = await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        status: statusMap[body.status] as any
      }
    });

    // Create audit log
    await createAuditLog({
      userId: currentUser.userId,
      action: AuditAction.FEEDBACK_UPDATED,
      entity: 'Feedback',
      entityId: feedback.id,
      details: `Updated feedback status to ${body.status}`,
      metadata: {
        oldStatus: feedback.status,
        newStatus: body.status
      },
      ipAddress,
      userAgent
    });

    // TODO: Emit Socket.io event to feedback sender
    // io.to(`user-${feedback.senderId}`).emit('feedback-status-updated', { ... });

    return NextResponse.json({
      ok: true,
      feedback,
      message: 'Feedback status updated'
    });

  } catch (error: any) {
    console.error('Error updating feedback:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}