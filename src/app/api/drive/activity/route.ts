export const dynamic = 'force-dynamic';
// src/app/api/drive/activity/route.ts
// GET ?k=<key> — details panel for one file/folder: who uploaded it, when,
// preview state, and its activity history (uploads, replacements, moves,
// renames, trash/restore, deletes). For a folder, history covers everything
// inside it.

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser2 } from '@/lib/auth';
import { userCanAccessKey } from '@/lib/drive/access';
import { getItemDetails, isDriveIndexEnabled, listActivity, tsToIso } from '@/lib/drive/index-store';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const key = req.nextUrl.searchParams.get('k') || '';
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  if (!isDriveIndexEnabled()) return NextResponse.json({ enabled: false, activity: [], details: null });
  if (!(await userCanAccessKey(user, key))) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  try {
    const [details, activity] = await Promise.all([getItemDetails(key), listActivity(key, 50)]);
    return NextResponse.json({
      enabled: true,
      details: details && {
        key: details.key,
        name: details.name,
        isFolder: details.isFolder,
        size: Number(details.size || 0),
        mimeType: details.mimeType,
        storageTier: details.storageTier,
        lastModified: tsToIso(details.lastModified),
        createdAt: tsToIso(details.createdAt),
        uploadedBy: details.uploadedBy,
        uploadedByName: details.uploadedByName,
        previewStatus: details.previewStatus,
        durationSeconds: details.durationSeconds,
        width: details.width,
        height: details.height,
      },
      activity,
    });
  } catch (err: any) {
    console.error('[drive/activity] failed:', err);
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
