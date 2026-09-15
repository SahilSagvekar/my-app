// POST /api/script-linking/actions
// Manual link/unlink actions for scripts ↔ folders ↔ editor tasks.
//
// Body.action:
//   link-script-to-task   { taskId, shootTaskId, scriptId }
//   unlink-script-from-task { taskId }
//   link-folder-to-task   { folderId, taskId }
//   unlink-folder-from-task { folderId }
//   generate-folder-script { folderId }  — create DeliverableScript for slot (staff only)
//
// Editors may only act on tasks assigned to them. Videographers/admins can
// wire any same-client slot.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNotNull } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import {
  rawFootageFolder as rawFootageFolderTable,
  deliverableScript as deliverableScriptTable,
  task as taskTable,
  shootDetail as shootDetailTable,
  client as clientTable,
} from '@/lib/db/schema';
import { readShootScriptDocument } from '@/lib/shoot-scripts';
import { reassignRawFootageFolder } from '@/lib/raw-footage-folders';
import { ensureDeliverableScript, reassignDeliverableScript } from '@/lib/deliverable-scripts';

const STAFF = ['admin', 'manager', 'videographer'];
const CAN_ACT = [...STAFF, 'editor'];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (user.role || '').toLowerCase();
  if (!CAN_ACT.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { action } = body;
  if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 });

  const db = getDbHttp();
  const now = new Date().toISOString();
  const isStaff = STAFF.includes(role);

  try {
    if (action === 'link-script-to-task') {
      const { taskId, shootTaskId, scriptId } = body;
      if (!taskId || !shootTaskId || !scriptId) {
        return NextResponse.json({ error: 'taskId, shootTaskId, and scriptId are required' }, { status: 400 });
      }

      const [task] = await db.select({
        id: taskTable.id,
        clientId: taskTable.clientId,
        assignedTo: taskTable.assignedTo,
      }).from(taskTable).where(eq(taskTable.id, taskId)).limit(1);
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      if (!isStaff && task.assignedTo !== user.id) {
        return NextResponse.json({ error: 'You can only link scripts to your own tasks' }, { status: 403 });
      }

      const [shootTask] = await db.select({ clientId: taskTable.clientId })
        .from(taskTable).where(eq(taskTable.id, shootTaskId)).limit(1);
      if (!shootTask || shootTask.clientId !== task.clientId) {
        return NextResponse.json({ error: 'Script and task must belong to the same client' }, { status: 400 });
      }

      const [shoot] = await db.select({ scriptContent: shootDetailTable.scriptContent })
        .from(shootDetailTable).where(eq(shootDetailTable.taskId, shootTaskId)).limit(1);
      if (!shoot) return NextResponse.json({ error: 'Shoot not found' }, { status: 404 });
      const script = readShootScriptDocument(shoot.scriptContent).scripts.find((s) => s.id === scriptId);
      if (!script) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

      // One script → one task
      if (task.clientId) {
        const others = await db.select({ id: taskTable.id, shootScriptRef: taskTable.shootScriptRef })
          .from(taskTable)
          .where(and(eq(taskTable.clientId, task.clientId), isNotNull(taskTable.shootScriptRef)));
        for (const other of others) {
          if (other.id === taskId || !other.shootScriptRef) continue;
          try {
            const ref = JSON.parse(other.shootScriptRef);
            if (ref.scriptId === scriptId) {
              await db.update(taskTable).set({ shootScriptRef: null, updatedAt: now }).where(eq(taskTable.id, other.id));
            }
          } catch { /* ignore */ }
        }
      }

      const shootScriptRef = JSON.stringify({
        shootTaskId,
        scriptId,
        scriptTitle: script.title || '',
      });
      await db.update(taskTable).set({ shootScriptRef, updatedAt: now }).where(eq(taskTable.id, taskId));

      // Keep DeliverableScript.taskId in sync when a folder already points at this task
      const [folder] = await db.select({ id: rawFootageFolderTable.id })
        .from(rawFootageFolderTable).where(eq(rawFootageFolderTable.taskId, taskId)).limit(1);
      if (folder) {
        const [ds] = await db.select({ id: deliverableScriptTable.id })
          .from(deliverableScriptTable).where(eq(deliverableScriptTable.rawFootageFolderId, folder.id)).limit(1);
        if (ds) await reassignDeliverableScript(ds.id, { taskId });
      }

      return NextResponse.json({ ok: true, shootScriptRef: JSON.parse(shootScriptRef) });
    }

    if (action === 'unlink-script-from-task') {
      const { taskId } = body;
      if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
      const [task] = await db.select({ id: taskTable.id, assignedTo: taskTable.assignedTo })
        .from(taskTable).where(eq(taskTable.id, taskId)).limit(1);
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      if (!isStaff && task.assignedTo !== user.id) {
        return NextResponse.json({ error: 'You can only unlink scripts from your own tasks' }, { status: 403 });
      }
      await db.update(taskTable).set({ shootScriptRef: null, updatedAt: now }).where(eq(taskTable.id, taskId));
      return NextResponse.json({ ok: true });
    }

    if (action === 'link-folder-to-task') {
      const { folderId, taskId } = body;
      if (!folderId || !taskId) {
        return NextResponse.json({ error: 'folderId and taskId are required' }, { status: 400 });
      }

      const [folder] = await db.select().from(rawFootageFolderTable).where(eq(rawFootageFolderTable.id, folderId)).limit(1);
      if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

      const [task] = await db.select({
        id: taskTable.id,
        clientId: taskTable.clientId,
        assignedTo: taskTable.assignedTo,
      }).from(taskTable).where(eq(taskTable.id, taskId)).limit(1);
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      if (task.clientId !== folder.clientId) {
        return NextResponse.json({ error: 'Folder and task must belong to the same client' }, { status: 400 });
      }
      if (!isStaff && task.assignedTo !== user.id) {
        return NextResponse.json({ error: 'You can only link folders to your own tasks' }, { status: 403 });
      }

      await reassignRawFootageFolder(folderId, taskId);
      const [ds] = await db.select({ id: deliverableScriptTable.id })
        .from(deliverableScriptTable).where(eq(deliverableScriptTable.rawFootageFolderId, folderId)).limit(1);
      if (ds) await reassignDeliverableScript(ds.id, { taskId });

      return NextResponse.json({ ok: true });
    }

    if (action === 'unlink-folder-from-task') {
      const { folderId } = body;
      if (!folderId) return NextResponse.json({ error: 'folderId is required' }, { status: 400 });
      const [folder] = await db.select().from(rawFootageFolderTable).where(eq(rawFootageFolderTable.id, folderId)).limit(1);
      if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });

      if (!isStaff) {
        if (!folder.taskId) return NextResponse.json({ ok: true });
        const [task] = await db.select({ assignedTo: taskTable.assignedTo })
          .from(taskTable).where(eq(taskTable.id, folder.taskId)).limit(1);
        if (!task || task.assignedTo !== user.id) {
          return NextResponse.json({ error: 'You can only unlink folders from your own tasks' }, { status: 403 });
        }
      }

      await reassignRawFootageFolder(folderId, null);
      const [ds] = await db.select({ id: deliverableScriptTable.id })
        .from(deliverableScriptTable).where(eq(deliverableScriptTable.rawFootageFolderId, folderId)).limit(1);
      if (ds) await reassignDeliverableScript(ds.id, { taskId: null });

      return NextResponse.json({ ok: true });
    }

    if (action === 'generate-folder-script') {
      if (!isStaff) return NextResponse.json({ error: 'Only staff can generate scripts for a folder' }, { status: 403 });
      const { folderId } = body;
      if (!folderId) return NextResponse.json({ error: 'folderId is required' }, { status: 400 });

      const [folder] = await db.select().from(rawFootageFolderTable).where(eq(rawFootageFolderTable.id, folderId)).limit(1);
      if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      if (!folder.taskId) {
        return NextResponse.json({ error: 'Assign an editor task to this folder before generating a script' }, { status: 400 });
      }

      const [clientRow] = await db.select({ companyName: clientTable.companyName, name: clientTable.name })
        .from(clientTable).where(eq(clientTable.id, folder.clientId)).limit(1);
      if (!clientRow) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

      const result = await ensureDeliverableScript({
        clientId: folder.clientId,
        companyName: clientRow.companyName || clientRow.name,
        monthFolder: folder.monthFolder,
        deliverableSlug: folder.code,
        number: folder.number,
        taskId: folder.taskId,
        rawFootageFolderId: folder.id,
      });
      if (!result) return NextResponse.json({ error: 'Failed to generate script' }, { status: 500 });
      return NextResponse.json({ ok: true, id: result.id });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    console.error('[Script Linking Actions] POST error:', error);
    return NextResponse.json({ error: 'Linking action failed' }, { status: 500 });
  }
}
