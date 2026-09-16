export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import { createId } from '@/lib/db/id';
import {
  shootDetail as shootDetailTable,
  scriptShootLink as scriptShootLinkTable,
} from '@/lib/db/schema';
import {
  readShootScriptDocument,
  writeShootScriptDocument,
  type ShootScriptDocument,
  type ShootScriptReferenceFile,
} from '@/lib/shoot-scripts';
import { uploadBufferToS3, deleteFromS3 } from '@/lib/s3';

const CAN_ACCESS = ['admin', 'manager', 'videographer', 'client'];

async function authorize(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const role = (user.role || '').toLowerCase();
  if (!CAN_ACCESS.includes(role)) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

async function getShootAndScript(shootTaskId: string, scriptId: string) {
  const db = getDbHttp();
  const [shoot] = await db
    .select({
      taskId: shootDetailTable.taskId,
      scriptContent: shootDetailTable.scriptContent,
    })
    .from(shootDetailTable)
    .where(eq(shootDetailTable.taskId, shootTaskId))
    .limit(1);

  if (!shoot) return null;

  let targetShootTaskId = shootTaskId;
  let document = readShootScriptDocument(shoot.scriptContent);
  let script = document.scripts.find((s) => s.id === scriptId);

  // If not found in this shoot's own scripts, check if it was linked from another shoot
  if (!script) {
    const [link] = await db
      .select({ sourceShootTaskId: scriptShootLinkTable.sourceShootTaskId })
      .from(scriptShootLinkTable)
      .where(
        and(
          eq(scriptShootLinkTable.targetShootTaskId, shootTaskId),
          eq(scriptShootLinkTable.scriptId, scriptId)
        )
      )
      .limit(1);

    if (link) {
      const [sourceShoot] = await db
        .select({
          taskId: shootDetailTable.taskId,
          scriptContent: shootDetailTable.scriptContent,
        })
        .from(shootDetailTable)
        .where(eq(shootDetailTable.taskId, link.sourceShootTaskId))
        .limit(1);

      if (sourceShoot) {
        targetShootTaskId = sourceShoot.taskId;
        document = readShootScriptDocument(sourceShoot.scriptContent);
        script = document.scripts.find((s) => s.id === scriptId);
      }
    }
  }

  if (!script) return null;

  return { targetShootTaskId, document, script };
}

async function saveDocument(targetShootTaskId: string, document: ShootScriptDocument, userId?: number) {
  const db = getDbHttp();
  const now = new Date().toISOString();
  await db
    .update(shootDetailTable)
    .set({
      scriptContent: writeShootScriptDocument(document),
      scriptLastEditedAt: now,
      ...(userId ? { scriptLastEditedBy: userId } : {}),
      updatedAt: now,
    })
    .where(eq(shootDetailTable.taskId, targetShootTaskId));
}

// GET /api/shoots/[id]/scripts/[scriptId]/references
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string; scriptId: string }> }
) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;

  const { id: shootTaskId, scriptId } = await props.params;
  const target = await getShootAndScript(shootTaskId, scriptId);
  if (!target) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  return NextResponse.json({
    referenceLinks: target.script.referenceLinks || [],
    referenceFiles: target.script.referenceFiles || [],
  });
}

// PATCH /api/shoots/[id]/scripts/[scriptId]/references
// Body: { referenceLinks: string[] }
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string; scriptId: string }> }
) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;

  const { id: shootTaskId, scriptId } = await props.params;
  const target = await getShootAndScript(shootTaskId, scriptId);
  if (!target) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  try {
    const body = await req.json();
    const { referenceLinks } = body;

    if (!Array.isArray(referenceLinks)) {
      return NextResponse.json({ error: 'referenceLinks array is required' }, { status: 400 });
    }

    target.script.referenceLinks = referenceLinks;
    target.script.updatedAt = new Date().toISOString();

    await saveDocument(target.targetShootTaskId, target.document, auth.user.id);

    return NextResponse.json({
      success: true,
      referenceLinks: target.script.referenceLinks,
    });
  } catch (error) {
    console.error('[Script References] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update reference links' }, { status: 500 });
  }
}

// POST /api/shoots/[id]/scripts/[scriptId]/references
// Body: FormData with file
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string; scriptId: string }> }
) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;

  const { id: shootTaskId, scriptId } = await props.params;
  const target = await getShootAndScript(shootTaskId, scriptId);
  if (!target) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'A file is required' }, { status: 400 });
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size cannot exceed 10MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const folderPrefix = `references/${shootTaskId}/${scriptId}/`;
    const filename = `${Date.now()}-${safeFileName}`;

    const upload = await uploadBufferToS3({
      buffer,
      folderPrefix,
      filename,
      mimeType: file.type || 'application/octet-stream',
    });

    const newFile: ShootScriptReferenceFile = {
      id: createId(),
      key: upload.key,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      url: upload.url,
    };

    const existingFiles = target.script.referenceFiles || [];
    target.script.referenceFiles = [...existingFiles, newFile];
    target.script.updatedAt = new Date().toISOString();

    await saveDocument(target.targetShootTaskId, target.document, auth.user.id);

    return NextResponse.json({
      success: true,
      referenceFiles: target.script.referenceFiles,
    });
  } catch (error) {
    console.error('[Script References] POST error:', error);
    return NextResponse.json({ error: 'Failed to upload reference file' }, { status: 500 });
  }
}

// DELETE /api/shoots/[id]/scripts/[scriptId]/references?fileId=...
export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string; scriptId: string }> }
) {
  const auth = await authorize(req);
  if ('response' in auth) return auth.response;

  const { id: shootTaskId, scriptId } = await props.params;
  const target = await getShootAndScript(shootTaskId, scriptId);
  if (!target) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'fileId query parameter is required' }, { status: 400 });
    }

    const existingFiles = target.script.referenceFiles || [];
    const fileToDelete = existingFiles.find((f) => f.id === fileId || f.key === fileId);

    if (fileToDelete?.key) {
      try {
        await deleteFromS3(fileToDelete.key);
      } catch (err) {
        console.warn('Failed to delete S3 object for reference file:', err);
      }
    }

    target.script.referenceFiles = existingFiles.filter(
      (f) => f.id !== fileId && f.key !== fileId
    );
    target.script.updatedAt = new Date().toISOString();

    await saveDocument(target.targetShootTaskId, target.document, auth.user.id);

    return NextResponse.json({
      success: true,
      referenceFiles: target.script.referenceFiles,
    });
  } catch (error) {
    console.error('[Script References] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete reference file' }, { status: 500 });
  }
}
