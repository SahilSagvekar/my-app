// src/app/api/social/accounts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialAccount, socialPost } from '@/lib/db/schema';
import { count, desc, eq, inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET - List all connected accounts for a client
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // Verify access
    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isLinkedClient = user.linkedClientId === clientId;

    if (!isAdmin && !isLinkedClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const accounts = await db.select({
      id: socialAccount.id,
      platform: socialAccount.platform,
      platformId: socialAccount.platformId,
      platformName: socialAccount.platformName,
      profileUrl: socialAccount.profileUrl,
      profileImage: socialAccount.profileImage,
      followerCount: socialAccount.followerCount,
      isActive: socialAccount.isActive,
      lastSyncAt: socialAccount.lastSyncAt,
      createdAt: socialAccount.createdAt,
    }).from(socialAccount)
      .where(eq(socialAccount.clientId, clientId))
      .orderBy(desc(socialAccount.createdAt));

    const accountIds = accounts.map(a => a.id);
    const postCounts = accountIds.length > 0
      ? await db.select({ socialAccountId: socialPost.socialAccountId, count: count() })
          .from(socialPost)
          .where(inArray(socialPost.socialAccountId, accountIds))
          .groupBy(socialPost.socialAccountId)
      : [];
    const postCountMap = new Map(postCounts.map(pc => [pc.socialAccountId, Number(pc.count)]));

    return NextResponse.json({
      ok: true,
      accounts: accounts.map(a => ({
        ...a,
        postCount: postCountMap.get(a.id) || 0,
        lastSyncAt: a.lastSyncAt ? new Date(a.lastSyncAt).toISOString() : a.lastSyncAt,
        createdAt: new Date(a.createdAt).toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[SOCIAL ACCOUNTS] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect an account
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Get account to verify access
    const [account] = await db.select({
      clientId: socialAccount.clientId,
      platform: socialAccount.platform,
      platformName: socialAccount.platformName,
    }).from(socialAccount).where(eq(socialAccount.id, accountId)).limit(1);

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Verify access
    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isLinkedClient = user.linkedClientId === account.clientId;

    if (!isAdmin && !isLinkedClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Delete account (cascades to posts and analytics)
    await db.delete(socialAccount).where(eq(socialAccount.id, accountId));

    console.log(`[SOCIAL ACCOUNTS] Disconnected ${account.platform} account: ${account.platformName}`);

    return NextResponse.json({
      ok: true,
      message: `Disconnected ${account.platformName}`,
    });
  } catch (error: any) {
    console.error('[SOCIAL ACCOUNTS DELETE] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Toggle account active status
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { accountId, isActive } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Get account to verify access
    const [account] = await db.select({ clientId: socialAccount.clientId })
      .from(socialAccount).where(eq(socialAccount.id, accountId)).limit(1);

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    // Verify access
    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isLinkedClient = user.linkedClientId === account.clientId;

    if (!isAdmin && !isLinkedClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update account
    const [updated] = await db.update(socialAccount)
      .set({ isActive: isActive ?? true, updatedAt: new Date().toISOString() })
      .where(eq(socialAccount.id, accountId))
      .returning({
        id: socialAccount.id,
        platform: socialAccount.platform,
        platformName: socialAccount.platformName,
        isActive: socialAccount.isActive,
      });

    return NextResponse.json({
      ok: true,
      account: updated,
    });
  } catch (error: any) {
    console.error('[SOCIAL ACCOUNTS PATCH] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}