// src/app/api/social/posts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { socialPost, socialAccount, task } from '@/lib/db/schema';
import { and, asc, desc, eq, count, type SQL } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - List posts for a client or specific account
export async function GET(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
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

    // Build where conditions
    const conditions: SQL[] = [];

    if (accountId) {
      conditions.push(eq(socialPost.socialAccountId, accountId));
    } else if (clientId) {
      // Verify access
      const isAdmin = user.role === 'admin' || user.role === 'manager';
      const isLinkedClient = user.linkedClientId === clientId;

      if (!isAdmin && !isLinkedClient) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      conditions.push(eq(socialAccount.clientId, clientId));
    } else {
      return NextResponse.json(
        { error: 'Either clientId or accountId is required' },
        { status: 400 }
      );
    }

    if (platform) {
      conditions.push(eq(socialAccount.platform, platform));
    }

    if (taskId) {
      conditions.push(eq(socialPost.taskId, taskId));
    }

    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;
    const sortColumn = (socialPost as any)[sortBy] ?? socialPost.publishedAt;
    const orderExpr = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get posts
    const [postsRaw, totalRows] = await Promise.all([
      db.select({
        id: socialPost.id,
        platformPostId: socialPost.platformPostId,
        postType: socialPost.postType,
        title: socialPost.title,
        description: socialPost.description,
        thumbnailUrl: socialPost.thumbnailUrl,
        postUrl: socialPost.postUrl,
        publishedAt: socialPost.publishedAt,
        views: socialPost.views,
        likes: socialPost.likes,
        comments: socialPost.comments,
        shares: socialPost.shares,
        saves: socialPost.saves,
        watchTime: socialPost.watchTime,
        engagementRate: socialPost.engagementRate,
        taskId: socialPost.taskId,
        accountPlatform: socialAccount.platform,
        accountPlatformName: socialAccount.platformName,
        accountProfileImage: socialAccount.profileImage,
        taskTitle: task.title,
        taskStatus: task.status,
      })
        .from(socialPost)
        .innerJoin(socialAccount, eq(socialPost.socialAccountId, socialAccount.id))
        .leftJoin(task, eq(socialPost.taskId, task.id))
        .where(whereExpr)
        .orderBy(orderExpr)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() })
        .from(socialPost)
        .innerJoin(socialAccount, eq(socialPost.socialAccountId, socialAccount.id))
        .where(whereExpr),
    ]);

    const total = Number(totalRows[0]?.count ?? 0);

    return NextResponse.json({
      ok: true,
      posts: postsRaw.map(post => ({
        id: post.id,
        platform: post.accountPlatform,
        platformName: post.accountPlatformName,
        accountImage: post.accountProfileImage,
        platformPostId: post.platformPostId,
        postType: post.postType,
        title: post.title,
        description: post.description,
        thumbnailUrl: post.thumbnailUrl,
        postUrl: post.postUrl,
        publishedAt: new Date(post.publishedAt).toISOString(),
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        saves: post.saves,
        watchTime: post.watchTime,
        engagementRate: post.engagementRate,
        task: post.taskId ? { id: post.taskId, title: post.taskTitle, status: post.taskStatus } : null,
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

  } finally {
    await closeDb();
  }
}

// POST - Link a social post to a task
export async function POST(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
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
    const [postRow] = await db.select({ id: socialPost.id, clientId: socialAccount.clientId })
      .from(socialPost)
      .innerJoin(socialAccount, eq(socialPost.socialAccountId, socialAccount.id))
      .where(eq(socialPost.id, postId))
      .limit(1);

    if (!postRow) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Verify access to task
    const [taskRow] = await db.select({ clientId: task.clientId }).from(task)
      .where(eq(task.id, taskId)).limit(1);

    if (!taskRow) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify same client
    if (postRow.clientId !== taskRow.clientId) {
      return NextResponse.json(
        { error: 'Post and task must belong to the same client' },
        { status: 400 }
      );
    }

    // Verify user access
    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isLinkedClient = user.linkedClientId === taskRow.clientId;

    if (!isAdmin && !isLinkedClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Link post to task
    const [updated] = await db.update(socialPost)
      .set({ taskId, updatedAt: new Date().toISOString() })
      .where(eq(socialPost.id, postId))
      .returning({ id: socialPost.id, taskId: socialPost.taskId });

    const [taskInfo] = await db.select({ id: task.id, title: task.title }).from(task)
      .where(eq(task.id, taskId)).limit(1);

    return NextResponse.json({
      ok: true,
      post: {
        id: updated.id,
        taskId: updated.taskId,
        task: taskInfo ?? null,
      },
    });
  } catch (error: any) {
    console.error('[SOCIAL POSTS LINK] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  } finally {
    await closeDb();
  }
}

// DELETE - Unlink a post from a task
export async function DELETE(req: NextRequest) {
  const { db, closeDb } = getDb();
  try {
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
    const [post] = await db.select({ id: socialPost.id, clientId: socialAccount.clientId })
      .from(socialPost)
      .innerJoin(socialAccount, eq(socialPost.socialAccountId, socialAccount.id))
      .where(eq(socialPost.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isLinkedClient = user.linkedClientId === post.clientId;

    if (!isAdmin && !isLinkedClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Unlink
    await db.update(socialPost)
      .set({ taskId: null, updatedAt: new Date().toISOString() })
      .where(eq(socialPost.id, postId));

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

  } finally {
    await closeDb();
  }
}