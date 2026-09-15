// GET /api/script-linking/board?clientId=&monthFolder=
// Board of SF/LF folder slots with linked task, script, and live shoot dates.
// Used by the videographer/editor Script Linking side panel.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getCurrentUser2 } from '@/lib/auth';
import { getDbHttp } from '@/lib/db';
import {
  rawFootageFolder as rawFootageFolderTable,
  deliverableScript as deliverableScriptTable,
  task as taskTable,
  shootDetail as shootDetailTable,
} from '@/lib/db/schema';
import { getFolderShootDates } from '@/lib/raw-footage-folders';
import { readShootScriptDocument } from '@/lib/shoot-scripts';

const CAN_VIEW = ['admin', 'manager', 'videographer', 'editor'];

export async function GET(req: NextRequest) {
  const user = await getCurrentUser2(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (user.role || '').toLowerCase();
  if (!CAN_VIEW.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const monthFolder = searchParams.get('monthFolder');
  if (!clientId || !monthFolder) {
    return NextResponse.json({ error: 'clientId and monthFolder are required' }, { status: 400 });
  }

  const db = getDbHttp();

  try {
    const folders = await db
      .select({
        id: rawFootageFolderTable.id,
        code: rawFootageFolderTable.code,
        number: rawFootageFolderTable.number,
        folderPath: rawFootageFolderTable.folderPath,
        taskId: rawFootageFolderTable.taskId,
        taskTitle: taskTable.title,
        taskAssignedTo: taskTable.assignedTo,
        shootScriptRef: taskTable.shootScriptRef,
      })
      .from(rawFootageFolderTable)
      .leftJoin(taskTable, eq(rawFootageFolderTable.taskId, taskTable.id))
      .where(and(eq(rawFootageFolderTable.clientId, clientId), eq(rawFootageFolderTable.monthFolder, monthFolder)))
      .orderBy(asc(rawFootageFolderTable.code), asc(rawFootageFolderTable.number));

    const deliverableScripts = await db
      .select({
        id: deliverableScriptTable.id,
        code: deliverableScriptTable.code,
        number: deliverableScriptTable.number,
        title: deliverableScriptTable.title,
        status: deliverableScriptTable.status,
        taskId: deliverableScriptTable.taskId,
        rawFootageFolderId: deliverableScriptTable.rawFootageFolderId,
      })
      .from(deliverableScriptTable)
      .where(and(eq(deliverableScriptTable.clientId, clientId), eq(deliverableScriptTable.monthFolder, monthFolder)));

    const scriptByFolder = new Map(deliverableScripts.map((s) => [s.rawFootageFolderId, s]));

    // Shoot scripts available to link (from this client's shoots)
    const shoots = await db
      .select({
        taskId: shootDetailTable.taskId,
        shootDate: shootDetailTable.shootDate,
        scriptContent: shootDetailTable.scriptContent,
        title: taskTable.title,
      })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .where(eq(taskTable.clientId, clientId))
      .orderBy(desc(shootDetailTable.shootDate));

    const availableShootScripts = shoots.flatMap((shoot) => {
      const doc = readShootScriptDocument(shoot.scriptContent);
      return doc.scripts.map((script) => ({
        id: script.id,
        title: script.title,
        status: script.status,
        shootTaskId: shoot.taskId,
        shootTitle: shoot.title,
        shootDate: shoot.shootDate,
      }));
    });

    // Editor tasks for this client (SF/LF), optionally scoped to "mine" for editors
    const taskConditions = [
      eq(taskTable.clientId, clientId),
      inArray(taskTable.deliverableType, ['SF', 'LF']),
    ];
    if (role === 'editor') {
      taskConditions.push(eq(taskTable.assignedTo, user.id));
    }

    const tasks = await db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        status: taskTable.status,
        deliverableType: taskTable.deliverableType,
        assignedTo: taskTable.assignedTo,
        shootScriptRef: taskTable.shootScriptRef,
        monthFolder: taskTable.monthFolder,
      })
      .from(taskTable)
      .where(and(...taskConditions))
      .orderBy(desc(taskTable.createdAt))
      .limit(200);

    const slots = await Promise.all(folders.map(async (folder) => {
      const deliverable = scriptByFolder.get(folder.id) || null;
      let linkedShootScript: {
        id: string;
        title: string;
        status: string;
        shootTaskId: string;
        shootDate: string | null;
      } | null = null;

      if (folder.shootScriptRef) {
        try {
          const ref = JSON.parse(folder.shootScriptRef);
          const match = availableShootScripts.find((s) => s.id === ref.scriptId && s.shootTaskId === ref.shootTaskId);
          if (match) {
            linkedShootScript = {
              id: match.id,
              title: match.title,
              status: match.status,
              shootTaskId: match.shootTaskId,
              shootDate: match.shootDate,
            };
          } else if (ref.scriptId) {
            linkedShootScript = {
              id: ref.scriptId,
              title: ref.scriptTitle || 'Linked script',
              status: 'unknown',
              shootTaskId: ref.shootTaskId,
              shootDate: null,
            };
          }
        } catch { /* ignore */ }
      }

      const shootDates = await getFolderShootDates(folder.taskId);

      return {
        key: `${folder.code}${folder.number}`,
        folder: {
          id: folder.id,
          code: folder.code,
          number: folder.number,
          folderPath: folder.folderPath,
          taskId: folder.taskId,
          taskTitle: folder.taskTitle,
        },
        deliverableScript: deliverable,
        shootScript: linkedShootScript,
        shootDates,
        hasScript: !!(deliverable || linkedShootScript),
      };
    }));

    return NextResponse.json({
      slots,
      availableShootScripts,
      tasks,
      role,
      canManageAll: ['admin', 'manager', 'videographer'].includes(role),
    });
  } catch (error: unknown) {
    console.error('[Script Linking Board] GET error:', error);
    return NextResponse.json({ error: 'Failed to load linking board' }, { status: 500 });
  }
}
