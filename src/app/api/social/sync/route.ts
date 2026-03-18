// src/app/api/social/sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser2 } from '@/lib/auth';
import { syncSocialAccount, syncClientAccounts } from '@/lib/social/sync';

export const maxDuration = 120; // 2 minutes max

// POST - Trigger sync for a client or specific account
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser2(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const accountId = searchParams.get('accountId');

    // If specific account requested
    if (accountId) {
      const account = await prisma.socialAccount.findUnique({
        where: { id: accountId },
        select: { clientId: true },
      });

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      // Verify access (admin/manager or linked client)
      const isAdmin = user.role === 'admin' || user.role === 'manager';
      const isLinkedClient = user.linkedClientId === account.clientId;

      if (!isAdmin && !isLinkedClient) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const result = await syncSocialAccount(accountId);
      return NextResponse.json({ ok: true, ...result });
    }

    // Sync all accounts for a client
    if (clientId) {
      // Verify access
      const isAdmin = user.role === 'admin' || user.role === 'manager';
      const isLinkedClient = user.linkedClientId === clientId;

      if (!isAdmin && !isLinkedClient) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const result = await syncClientAccounts(clientId);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json(
      { error: 'Either clientId or accountId is required' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[SOCIAL SYNC] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Get sync status
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
        platformName: true,
        isActive: true,
        lastSyncAt: true,
        followerCount: true,
      },
    });

    return NextResponse.json({
      ok: true,
      accounts: accounts.map(a => ({
        ...a,
        lastSyncAt: a.lastSyncAt?.toISOString(),
        needsSync: !a.lastSyncAt || 
          (Date.now() - a.lastSyncAt.getTime()) > 6 * 60 * 60 * 1000, // 6 hours
      })),
    });
  } catch (error: any) {
    console.error('[SOCIAL SYNC STATUS] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}