export const dynamic = 'force-dynamic';
// src/app/api/shared/[shareToken]/route.ts
//
// Resolves a client review share link (created via POST /api/tasks/[id]/share,
// which writes a ShareableReview row). Consumed by
// src/app/shared/review/[shareToken]/page.tsx.
//
// Uses Drizzle over the Neon HTTP driver (getDbHttp) like the rest of the
// Cloudflare Workers app — the old Prisma + ws client does not run reliably
// on Workers and was surfacing here as a generic 500 ("Failed to load shared
// review").
//
// NOTE: folder-share (ShareableFile) logic lives in
// src/app/api/shared/folder/[shareToken]/route.ts.

import { NextRequest, NextResponse } from 'next/server';
import { getDbHttp } from '@/lib/db';
import {
  shareableReview,
  task as taskTable,
  client as clientTable,
  monthlyDeliverable as monthlyDeliverableTable,
  file as fileTable,
} from '@/lib/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { generateSignedUrl } from '@/lib/s3';

// Drizzle returns timestamps as strings (mode: 'string'), often without a
// timezone suffix. They are stored in UTC, so parse them as UTC.
function parseUtc(value: string): Date {
  const hasTz = /([zZ]|[+-]\d{2}(:?\d{2})?)$/.test(value);
  return new Date(hasTz ? value : value.replace(' ', 'T') + 'Z');
}

function safeDecode(key: string): string {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  const db = getDbHttp();
  try {
    const { shareToken } = await params;

    if (!shareToken) {
      return NextResponse.json({ error: 'Share token required' }, { status: 400 });
    }

    const [share] = await db
      .select()
      .from(shareableReview)
      .where(eq(shareableReview.shareToken, shareToken))
      .limit(1);

    if (!share) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }
    if (!share.isActive) {
      return NextResponse.json({ error: 'This share link has been deactivated' }, { status: 410 });
    }
    if (share.expiresAt && parseUtc(share.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
    }

    const [taskRow] = await db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        description: taskTable.description,
        status: taskTable.status,
        driveLinks: taskTable.driveLinks,
        createdAt: taskTable.createdAt,
        socialMediaLinks: taskTable.socialMediaLinks,
        clientId: clientTable.id,
        clientName: clientTable.name,
        clientCompanyName: clientTable.companyName,
        deliverableType: monthlyDeliverableTable.type,
        deliverablePlatforms: monthlyDeliverableTable.platforms,
      })
      .from(taskTable)
      .leftJoin(clientTable, eq(taskTable.clientId, clientTable.id))
      .leftJoin(
        monthlyDeliverableTable,
        eq(taskTable.monthlyDeliverableId, monthlyDeliverableTable.id)
      )
      .where(eq(taskTable.id, share.taskId))
      .limit(1);

    if (!taskRow) {
      return NextResponse.json({ error: 'Shared task not found' }, { status: 404 });
    }

    const files = await db
      .select({
        id: fileTable.id,
        name: fileTable.name,
        url: fileTable.url,
        s3Key: fileTable.s3Key,
        size: fileTable.size,
        mimeType: fileTable.mimeType,
        version: fileTable.version,
        folderType: fileTable.folderType,
        uploadedAt: fileTable.uploadedAt,
        createdAt: fileTable.createdAt,
      })
      .from(fileTable)
      .where(and(eq(fileTable.taskId, taskRow.id), eq(fileTable.isActive, true)))
      .orderBy(asc(fileTable.folderType), desc(fileTable.version));

    // Files are private — the raw `url` column isn't directly playable, so
    // sign each one (same pattern as /api/tasks/[id]/files).
    const filesWithSignedUrls = await Promise.all(
      files.map(async (f) => {
        let url = f.url;
        if (f.s3Key) {
          try {
            url = await generateSignedUrl(safeDecode(f.s3Key));
          } catch (err) {
            console.error(`❌ Failed to sign URL for shared file ${f.id}:`, err);
          }
        }
        return {
          id: f.id,
          name: f.name,
          url,
          size: Number(f.size),
          mimeType: f.mimeType,
          version: f.version,
          folderType: f.folderType,
          uploadedAt: f.uploadedAt,
          createdAt: f.createdAt,
        };
      })
    );

    // Bump view count + last-viewed, best-effort (don't fail the request over it)
    try {
      const now = new Date().toISOString();
      await db
        .update(shareableReview)
        .set({
          viewCount: sql`${shareableReview.viewCount} + 1`,
          lastViewedAt: now,
          updatedAt: now,
        })
        .where(eq(shareableReview.id, share.id));
    } catch (err) {
      console.error('⚠️ Failed to update share view count:', err);
    }

    return NextResponse.json({
      task: {
        id: taskRow.id,
        title: taskRow.title,
        description: taskRow.description,
        status: taskRow.status,
        driveLinks: taskRow.driveLinks || [],
        files: filesWithSignedUrls,
        client: taskRow.clientId
          ? {
              id: taskRow.clientId,
              name: taskRow.clientName,
              companyName: taskRow.clientCompanyName,
            }
          : null,
        monthlyDeliverable: taskRow.deliverableType
          ? {
              type: taskRow.deliverableType,
              platforms: taskRow.deliverablePlatforms || [],
            }
          : null,
        createdAt: taskRow.createdAt,
        socialMediaLinks: taskRow.socialMediaLinks,
      },
      shareInfo: {
        viewCount: share.viewCount + 1,
        expiresAt: share.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[shared/review] error:', error);
    return NextResponse.json(
      { error: 'Failed to load shared review', details: error.message },
      { status: 500 }
    );
  }
}
