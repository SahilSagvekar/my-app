// app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromToken } from '@/lib/auth-helpers';
import { createAuditLog, AuditAction, getRequestMetadata } from '@/lib/audit-logger';
import { FeedbackCategory, FeedbackPriority } from '@prisma/client';

// GET - Fetch all feedback
export async function GET(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');

    // Build where clause
    let where: any = {};

    // Admin and managers see all feedback
    // Other users only see their own feedback
    if (!['admin', 'manager'].includes(currentUser.role)) {
      where.senderId = currentUser.userId;
    }

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } }
      ];
    }

    const feedback = await prisma.feedback.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format for frontend
    const formattedFeedback = feedback.map(item => ({
      id: item.id,
      subject: item.subject,
      message: item.message,
      category: item.category.toLowerCase(),
      priority: item.priority.toLowerCase(),
      status: item.status.toLowerCase().replace('_', '-'),
      sender: {
        id: item.sender.id.toString(),
        name: item.sender.name || 'Unknown',
        role: item.sender.role || 'user',
        avatar: getInitials(item.sender.name || 'U')
      },
      recipients: ['admin', 'manager'],
      createdAt: item.createdAt.toISOString(),
      responses: item.responses.map(resp => ({
        id: resp.id,
        message: resp.message,
        sender: {
          id: resp.sender.id.toString(),
          name: resp.sender.name || 'Unknown',
          role: resp.sender.role || 'user',
          avatar: getInitials(resp.sender.name || 'U')
        },
        createdAt: resp.createdAt.toISOString()
      }))
    }));

    return NextResponse.json({
      ok: true,
      feedback: formattedFeedback,
      total: formattedFeedback.length
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new feedback
export async function POST(req: NextRequest) {
  try {
    const currentUser = getUserFromToken(req);
    
    if (!currentUser) {
      return NextResponse.json(
        { ok: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { ipAddress, userAgent } = getRequestMetadata(req);

    // Validate required fields
    if (!body.subject || !body.message) {
      return NextResponse.json(
        { ok: false, message: 'Subject and message are required' },
        { status: 400 }
      );
    }

    // Map frontend values to enum values
    const categoryMap: { [key: string]: FeedbackCategory } = {
      'general': FeedbackCategory.GENERAL,
      'technical': FeedbackCategory.TECHNICAL,
      'workflow': FeedbackCategory.WORKFLOW,
      'suggestion': FeedbackCategory.SUGGESTION,
      'bug-report': FeedbackCategory.BUG_REPORT
    };

    const priorityMap: { [key: string]: FeedbackPriority } = {
      'low': FeedbackPriority.LOW,
      'medium': FeedbackPriority.MEDIUM,
      'high': FeedbackPriority.HIGH
    };

    // Create feedback
    const feedback = await prisma.feedback.create({
      data: {
        subject: body.subject,
        message: body.message,
        category: categoryMap[body.category] || FeedbackCategory.GENERAL,
        priority: priorityMap[body.priority] || FeedbackPriority.MEDIUM,
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

    // Create audit log
    await createAuditLog({
      userId: currentUser.userId,
      action: AuditAction.FEEDBACK_CREATED,
      entity: 'Feedback',
      entityId: feedback.id,
      details: `Created feedback: ${feedback.subject}`,
      metadata: {
        category: feedback.category,
        priority: feedback.priority
      },
      ipAddress,
      userAgent
    });

    // TODO: Emit Socket.io event to admins/managers
    // io.to('feedback-receivers').emit('new-feedback', { ... });

    return NextResponse.json({
      ok: true,
      feedback: {
        id: feedback.id,
        subject: feedback.subject,
        message: feedback.message,
        category: feedback.category.toLowerCase(),
        priority: feedback.priority.toLowerCase(),
        status: 'pending',
        sender: {
          id: feedback.sender.id.toString(),
          name: feedback.sender.name || 'Unknown',
          role: feedback.sender.role || 'user',
          avatar: getInitials(feedback.sender.name || 'U')
        },
        createdAt: feedback.createdAt.toISOString(),
        responses: []
      },
      message: 'Feedback submitted successfully'
    });

  } catch (error: any) {
    console.error('Error creating feedback:', error);
    return NextResponse.json(
      { ok: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to get initials
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}