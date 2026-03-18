// src/app/api/cron/sync-social/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncSocialAccount } from '@/lib/social/sync';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[CRON] Unauthorized sync attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON] Starting social accounts sync...');

  try {
    const accounts = await prisma.socialAccount.findMany({
      where: { isActive: true },
      select: { 
        id: true, 
        platform: true, 
        platformName: true,
        clientId: true,
      },
      orderBy: { lastSyncAt: 'asc' }, // Sync oldest first
    });

    console.log(`[CRON] Found ${accounts.length} active accounts to sync`);

    const results: Array<{
      id: string;
      platform: string;
      platformName: string;
      status: 'success' | 'error';
      error?: string;
      postsSynced?: number;
    }> = [];

    for (const account of accounts) {
      try {
        console.log(`[CRON] Syncing ${account.platform}: ${account.platformName}`);
        
        const result = await syncSocialAccount(account.id);
        
        results.push({ 
          id: account.id, 
          platform: account.platform,
          platformName: account.platformName,
          status: 'success',
          postsSynced: result.postsSynced,
        });

        console.log(`[CRON] ✓ Synced ${account.platformName} (${result.postsSynced} posts)`);
      } catch (err: any) {
        console.error(`[CRON] ✗ Failed to sync ${account.platformName}:`, err.message);
        
        results.push({ 
          id: account.id, 
          platform: account.platform,
          platformName: account.platformName,
          status: 'error', 
          error: err.message,
        });
      }

      // Rate limit: wait 1 second between accounts to avoid API limits
      await new Promise(r => setTimeout(r, 1000));
    }

    const duration = Date.now() - startTime;
    const synced = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;

    console.log(`[CRON] Sync complete: ${synced} success, ${failed} failed in ${duration}ms`);

    return NextResponse.json({
      ok: true,
      duration: `${duration}ms`,
      total: accounts.length,
      synced,
      failed,
      results,
    });
  } catch (error: any) {
    console.error('[CRON] Fatal sync error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error.message,
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: NextRequest) {
  return GET(req);
} 