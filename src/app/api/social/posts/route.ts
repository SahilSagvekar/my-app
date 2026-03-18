// src/app/api/social/posts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - List posts for a client or specific account
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const accountId = searchParams.get('accountId');
    const platform = searchParams.get('platform');
    const taskId = searchParams.get('taskId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'publishedAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: any = {};

    if (accountId) {
      where.socialAccountId = accountId;
    } else if (clientId) {
      // Verify access
      const isAdmin = user.role === 'admin' || user.role === 'manager';
      const isLinkedClient = user.linkedClientId === clientId;

      if (!isAdmin && !isLinkedClient) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      where.socialAccount = { clientId };
    } else {
      return NextResponse.json(
        { error: 'Either clientId or accountId is required' },
        { status: 400 }
      );
    }

    if (platform) {
      where.socialAccount = { ...where.socialAccount, platform };
    }

    if (taskId) {
      where.taskId = taskId;
    }

    // Get posts
    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        include: {
          socialAccount: {
            select: {
              id: true,
              platform: true,
              platformName: true,
              profileImage: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      }),
      prisma.socialPost.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      posts: posts.map(post => ({
        id: post.id,
        platform: post.socialAccount.platform,
        platformName: post.socialAccount.platformName,
        accountImage: post.socialAccount.profileImage,
        platformPostId: post.platformPostId,
        postType: post.postType,
        title: post.title,
        description: post.description,
        thumbnailUrl: post.thumbnailUrl,
        postUrl: post.postUrl,
        publishedAt: post.publishedAt.toISOString(),
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        watchTime: post.watchTime,
        engagementRate: post.engagementRate,
        task: post.task,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('[SOCIAL POSTS] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Link a social post to a task
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { postId, taskId } = body;

    if (!postId || !taskId) {
      return NextResponse.json(
        { error: 'postId and taskId are required' },
        { status: 400 }
      );
    }

    // Verify access to post
    const post = await prisma.socialPost.findUnique({
      where: { id: postId },
      include: {
        socialAccount: {
          select: { clientId: true },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Verify access to task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { clientId: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify same client
    if (post.socialAccount.clientId !== task.clientId) {
      return NextResponse.json(
        { error: 'Post and task must belong to the same client' },
        { status: 400 }
      );
    }

    // Verify user access
    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isLinkedClient = user.linkedClientId === task.clientId;

    if (!isAdmin && !isLinkedClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Link post to task
    const updated = await prisma.socialPost.update({
      where: { id: postId },
      data: { taskId },
      include: {
        task: {
          select: { id: true, title: true },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      post: {
        id: updated.id,
        taskId: updated.taskId,
        task: updated.task,
      },
    });
  } catch (error: any) {
    console.error('[SOCIAL POSTS LINK] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Unlink a post from a task
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    // Verify access
    const post = await prisma.socialPost.findUnique({
      where: { id: postId },
      include: {
        socialAccount: {
          select: { clientId: true },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isLinkedClient = user.linkedClientId === post.socialAccount.clientId;

    if (!isAdmin && !isLinkedClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Unlink
    await prisma.socialPost.update({
      where: { id: postId },
      data: { taskId: null },
    });

    return NextResponse.json({
      ok: true,
      message: 'Post unlinked from task',
    });
  } catch (error: any) {
    console.error('[SOCIAL POSTS UNLINK] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}