import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addSignedUrlsToFiles } from '@/lib/s3';

// GET /api/shared/[shareToken] - Access a shared review
export async function GET(
    req: NextRequest,
    { params }: { params: { shareToken: string } }
) {
    try {
        const { shareToken } = params;

        if (!shareToken) {
            return NextResponse.json({ error: 'Share token required' }, { status: 400 });
        }

        // Find the shareable review
        const shareableReview = await prisma.shareableReview.findUnique({
            where: { shareToken },
        });

        if (!shareableReview) {
            return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
        }

        // Check if the link is active
        if (!shareableReview.isActive) {
            return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 410 });
        }

        // Check if the link has expired
        if (shareableReview.expiresAt && shareableReview.expiresAt < new Date()) {
            return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
        }

        // Get the task details with all necessary relations
        const task = await prisma.task.findUnique({
            where: { id: shareableReview.taskId },
            include: {
                client: {
                    select: {
                        id: true,
                        name: true,
                        companyName: true,
                    }
                },
                files: {
                    where: { isActive: true },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        name: true,
                        url: true,
                        mimeType: true,
                        size: true,
                        folderType: true,
                        version: true,
                        uploadedAt: true,
                        createdAt: true,
                        s3Key: true,
                    }
                },
                taskFeedback: {
                    where: { status: 'needs_revision' },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        feedback: true,
                        timestamp: true,
                        category: true,
                        folderType: true,
                        fileId: true,
                        createdAt: true,
                    }
                },
                monthlyDeliverable: {
                    select: {
                        type: true,
                        platforms: true,
                        description: true,
                    }
                }
            }
        });

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Update view count and last viewed timestamp
        await prisma.shareableReview.update({
            where: { shareToken },
            data: {
                viewCount: { increment: 1 },
                lastViewedAt: new Date(),
            }
        });

        // Return task data (sanitized for public viewing)
        return NextResponse.json({
            success: true,
            task: {
                id: task.id,
                title: task.title,
                description: task.description,
                taskType: task.taskType,
                status: task.status,
                dueDate: task.dueDate,
                priority: task.priority,
                taskCategory: task.taskCategory,
                folderType: task.folderType,
                qcNotes: task.qcNotes,
                feedback: task.feedback,
                createdAt: task.createdAt,
                updatedAt: task.updatedAt,
                client: task.client,
                files: await addSignedUrlsToFiles(task.files),
                taskFeedback: task.taskFeedback,
                monthlyDeliverable: task.monthlyDeliverable,
                socialMediaLinks: task.socialMediaLinks,
            },
            shareInfo: {
                viewCount: shareableReview.viewCount + 1,
                expiresAt: shareableReview.expiresAt,
            }
        });

    } catch (error) {
        console.error('Error accessing shared review:', error);
        return NextResponse.json(
            { error: 'Failed to load shared review' },
            { status: 500 }
        );
    }
}
