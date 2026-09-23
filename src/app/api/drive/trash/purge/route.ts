export const dynamic = 'force-dynamic';
// src/app/api/drive/trash/purge/route.ts
// POST { rootKeys: string[], totpCode } — "Delete forever" from the Trash.
// Admin-only and gated by a fresh Google Authenticator code, the same gate
// the old immediate delete had. Runs the original permanent-delete steps
// (R2 delete, NAS backup flags, raw-footage storage credit) on exactly
// the keys that were trashed together.

import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getCurrentUser2 } from '@/lib/auth';
import { verifyTotpCode } from '@/lib/totp-verify';
import { isDriveTrashEnabled, logDriveActivity } from '@/lib/drive/index-store';
import { purgeTrashRoot } from '@/lib/drive/permanent-delete';

const MAX_PER_REQUEST = 100;

export async function POST(req: NextRequest) {
  const { env } = getCloudflareContext();
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin') return NextResponse.json({ error: 'Only admins can permanently delete' }, { status: 403 });
  if (!isDriveTrashEnabled()) return NextResponse.json({ error: 'Trash is not enabled' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const totp = await verifyTotpCode(user.id, body?.totpCode);
  if (!totp.ok) {
    return NextResponse.json({
      error: totp.reason === 'not_set_up'
        ? '2FA is not set up for your account — set it up before deleting files'
        : totp.reason === 'missing_code' ? 'Verification code required' : 'Invalid verification code',
      totpReason: totp.reason,
    }, { status: totp.reason === 'not_set_up' ? 428 : 401 });
  }

  const rootKeys: string[] = (Array.isArray(body?.rootKeys) ? body.rootKeys : [])
    .filter((k: unknown): k is string => typeof k === 'string' && !!k)
    .slice(0, MAX_PER_REQUEST);
  if (!rootKeys.length) return NextResponse.json({ error: 'No items given' }, { status: 400 });

  const deleted: string[] = [];
  const failed: { rootKey: string; error: string }[] = [];
  for (const rootKey of rootKeys) {
    try {
      // purgeTrashRoot only deletes rows that are actually in the trash under
      // this root — anything else throws 'Not in trash'.
      await purgeTrashRoot(env, rootKey);
      deleted.push(rootKey);
    } catch (err: any) {
      failed.push({ rootKey, error: err?.message || 'Delete failed' });
    }
  }

  await logDriveActivity(deleted.map((k) => ({ key: k, action: 'deleted', userId: user.id, details: { permanent: true } })));
  try {
    const { createAuditLog, AuditAction } = await import('@/lib/audit-logger');
    await createAuditLog({
      userId: user.id,
      action: AuditAction.FILE_DELETED,
      entity: 'DriveItem',
      entityId: deleted.length === 1 ? deleted[0] : 'bulk',
      details: `Permanently deleted ${deleted.length} item(s) from Drive trash${failed.length ? `, ${failed.length} failed` : ''}.`,
      metadata: { deleted, failed },
    });
  } catch {
    /* non-critical */
  }

  return NextResponse.json({ success: true, deletedCount: deleted.length, deleted, failed });
}
