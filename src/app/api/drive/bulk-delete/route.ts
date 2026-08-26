export const dynamic = 'force-dynamic';
// src/app/api/drive/bulk-delete/route.ts
//
// Admin-only bulk delete for Files & Drive. Requires a fresh Google
// Authenticator code, verified server-side, same as the single-item
// delete route (see /api/drive/delete) — bulk delete is not a way around
// that check, it's built on the same gate.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import { user as userTable, client as clientTable } from '@/lib/db/schema';
import { eq, or } from 'drizzle-orm';
import { updateClientStorageAfterDelete } from '@/lib/storage-service';
import { getCurrentUser2 } from '@/lib/auth';
import { deleteItem } from '@/lib/file-server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { verifyTotpCode } from '@/lib/totp-verify';

interface BulkDeleteItem {
  s3Key: string;
  type: 'file' | 'folder';
}

export async function DELETE(request: NextRequest) {
  const db = getDbHttp();
  const { env } = getCloudflareContext();
  try {
    const user = await getCurrentUser2(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Bulk delete is admin-only, full stop — not gated per-item like the
    // single delete route is for clients/editors.
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can bulk delete' }, { status: 403 });
    }

    const body = await request.json();
    const items: BulkDeleteItem[] = Array.isArray(body.items) ? body.items : [];
    const totpCode: string | undefined = body.totpCode;

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }
    for (const item of items) {
      if (!item?.s3Key || (item.type !== 'file' && item.type !== 'folder')) {
        return NextResponse.json({ error: 'Each item needs a valid s3Key and type' }, { status: 400 });
      }
    }

    const totpResult = await verifyTotpCode(user.id, totpCode);
    if (!totpResult.ok) {
      const status = totpResult.reason === 'not_set_up' ? 428 : 401;
      return NextResponse.json({
        error: totpResult.reason === 'not_set_up'
          ? '2FA is not set up for your account — set it up before deleting files'
          : totpResult.reason === 'missing_code'
          ? 'Verification code required'
          : 'Invalid verification code',
        totpReason: totpResult.reason,
      }, { status });
    }

    const deleted: string[] = [];
    const failed: { s3Key: string; error: string }[] = [];

    // Track raw-footage storage deltas per client so we only issue one
    // storage update per client instead of one per file.
    const storageDeltaByCompany = new Map<string, number>();

    for (const item of items) {
      try {
        const result = await deleteItem(env, user.id, user.role, item.s3Key, item.type);
        deleted.push(item.s3Key);

        if (item.s3Key.includes('raw-footage') && result?.deletedSize > 0) {
          const companyName = item.s3Key.split('/')[0];
          storageDeltaByCompany.set(companyName, (storageDeltaByCompany.get(companyName) || 0) + result.deletedSize);
        }
      } catch (err: any) {
        failed.push({ s3Key: item.s3Key, error: err?.message || 'Delete failed' });
      }
    }

    for (const [companyName, deletedSize] of storageDeltaByCompany) {
      const [foundClient] = await db
        .select({ id: clientTable.id })
        .from(clientTable)
        .where(or(eq(clientTable.companyName, companyName), eq(clientTable.name, companyName)))
        .limit(1);
      if (foundClient) await updateClientStorageAfterDelete(foundClient.id, deletedSize);
    }

    try {
      const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
      await createAuditLog({
        userId: user.id,
        action: AuditAction.FILE_DELETED,
        entity: 'DriveItem',
        entityId: 'bulk',
        details: `Bulk deleted ${deleted.length} item(s) in Files & Drive${failed.length > 0 ? `, ${failed.length} failed` : ''}.`,
        metadata: { deletedCount: deleted.length, failedCount: failed.length, deleted, failed },
      });
    } catch (auditErr) {
      console.error('Audit log failed (non-critical):', auditErr);
    }

    return NextResponse.json({
      success: true,
      deletedCount: deleted.length,
      deleted,
      failed,
    });
  } catch (error: any) {
    console.error('Bulk delete error:', error);
    return NextResponse.json({ error: 'Bulk delete failed', details: error.message }, { status: 500 });
  }
}