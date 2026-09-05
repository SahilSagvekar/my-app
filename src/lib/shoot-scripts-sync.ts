import { and, eq, isNotNull, isNull, ne, inArray } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import { shootDetail as shootDetailTable, task as taskTable } from '@/lib/db/schema';
import { readShootScriptDocument } from '@/lib/shoot-scripts';

/**
 * Synchronizes shoot scripts to editor production tasks:
 * - Attaches scripts in 'draft', 'sent', or 'approved' status.
 * - Detaches/unlinks scripts in 'changes_requested' (rejected) status.
 */
export async function syncShootScriptsToTasks(shootTaskId: string, db = getDbHttp()) {
  try {
    const [shoot] = await db
      .select({
        scriptContent: shootDetailTable.scriptContent,
        clientId: taskTable.clientId,
      })
      .from(shootDetailTable)
      .innerJoin(taskTable, eq(shootDetailTable.taskId, taskTable.id))
      .where(eq(shootDetailTable.taskId, shootTaskId))
      .limit(1);

    if (!shoot || !shoot.clientId) return;

    const document = readShootScriptDocument(shoot.scriptContent);
    const now = new Date().toISOString();

    // Scripts that SHOULD be attached (draft, not sent yet, sent, approved)
    const validScripts = document.scripts.filter(
      (s) => s.status !== 'changes_requested'
    );
    // Scripts that are rejected / changes_requested
    const rejectedScriptIds = new Set(
      document.scripts
        .filter((s) => s.status === 'changes_requested')
        .map((s) => s.id)
    );
    const validScriptIds = new Set(validScripts.map((s) => s.id));

    // 1. Fetch all production tasks for this client that currently have shootScriptRef
    const existingLinkedTasks = await db
      .select({ id: taskTable.id, shootScriptRef: taskTable.shootScriptRef })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.clientId, shoot.clientId),
          isNotNull(taskTable.shootScriptRef)
        )
      );

    const alreadyLinkedScriptIds = new Set<string>();

    for (const t of existingLinkedTasks) {
      if (!t.shootScriptRef) continue;
      try {
        const ref = JSON.parse(t.shootScriptRef);
        if (ref.shootTaskId === shootTaskId) {
          // If this script is now rejected or removed from the shoot, unlink it!
          if (rejectedScriptIds.has(ref.scriptId) || !validScriptIds.has(ref.scriptId)) {
            await db
              .update(taskTable)
              .set({ shootScriptRef: null, updatedAt: now })
              .where(eq(taskTable.id, t.id));
          } else {
            alreadyLinkedScriptIds.add(ref.scriptId);
          }
        } else {
          if (ref.scriptId) alreadyLinkedScriptIds.add(ref.scriptId);
        }
      } catch {
        // Ignore invalid JSON ref
      }
    }

    // 2. For each valid script (draft, sent, approved) not yet linked, find an unlinked task
    const scriptsToLink = validScripts.filter((s) => !alreadyLinkedScriptIds.has(s.id));
    if (scriptsToLink.length === 0) return;

    // Fetch candidate unlinked production tasks for this client
    const candidateTasks = await db
      .select({ id: taskTable.id, title: taskTable.title })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.clientId, shoot.clientId),
          isNull(taskTable.shootScriptRef),
          ne(taskTable.taskCategory ?? 'none', 'review'),
          inArray(taskTable.status, ['PENDING', 'IN_PROGRESS'])
        )
      )
      .limit(50);

    const availableTaskPool = [...candidateTasks];

    for (const script of scriptsToLink) {
      if (availableTaskPool.length === 0) break;

      // Try matching by number at end of script title (e.g. "Video 3" -> task ending in "3")
      const scriptNumberMatch = (script.title || '').match(/(\d+)$/);
      const scriptNumber = scriptNumberMatch ? parseInt(scriptNumberMatch[1], 10) : null;

      let targetIdx = -1;
      if (scriptNumber !== null) {
        targetIdx = availableTaskPool.findIndex((t) => {
          const tMatch = (t.title || '').match(/(\d+)$/);
          return tMatch && parseInt(tMatch[1], 10) === scriptNumber;
        });
      }

      if (targetIdx === -1) {
        targetIdx = 0; // Take first available unlinked task
      }

      const [targetTask] = availableTaskPool.splice(targetIdx, 1);
      const scriptRef = JSON.stringify({
        shootTaskId,
        scriptId: script.id,
        scriptTitle: script.title || '',
      });

      await db
        .update(taskTable)
        .set({ shootScriptRef: scriptRef, updatedAt: now })
        .where(eq(taskTable.id, targetTask.id));
    }
  } catch (err) {
    console.error('[syncShootScriptsToTasks] Error:', err);
  }
}
