// src/app/api/social/accounts/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    const accounts = await prisma.socialAccount.findMany({
      where: { clientId },
      select: {
        id: true,
        platform: true,
        platformId: true,
        platformName: true,
        profileUrl: true,
        profileImage: true,
        followerCount: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        _count: {
          select: { posts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      accounts: accounts.map(a => ({
        ...a,
        postCount: a._count.posts,
        lastSyncAt: a.lastSyncAt?.toISOString(),
        createdAt: a.createdAt.toISOString(),
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
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { clientId: true, platform: true, platformName: true },
    });

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
    await prisma.socialAccount.delete({
      where: { id: accountId },
    });

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
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { clientId: true },
    });

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
    const updated = await prisma.socialAccount.update({
      where: { id: accountId },
      data: { isActive: isActive ?? true },
      select: {
        id: true,
        platform: true,
        platformName: true,
        isActive: true,
      },
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