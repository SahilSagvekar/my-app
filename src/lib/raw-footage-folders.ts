// src/lib/raw-footage-folders.ts
//
// Auto-numbered raw-footage folders (SF1..SFn, LF1..LFn) — one RawFootageFolder
// row per client per month per numbered slot, physically backed by an R2
// folder marker at:
//   {companyName}/raw-footage/{monthFolder}/{deliverableFolderName}/{code}{number}/
// e.g. "CapDental/raw-footage/September-2026/Short Form Videos/SF3/" —
// nested inside the same type-named folder the repair tool already expects
// (getDeliverableFolderName), not flat under the month.
//
// A folder's displayed shoot date is NEVER stored here — see
// getFolderShootDates() below, which derives it live via the assigned
// task's script -> that script's linked shoot(s), per the "Shoot is the
// single source of truth for date" rule locked in the feature spec.

import { eq, and, inArray, isNull, asc } from 'drizzle-orm';
import { getDbHttp } from '@/lib/db';
import {
  rawFootageFolder as rawFootageFolderTable,
  task as taskTable,
  shootDetail as shootDetailTable,
  scriptShootLink as scriptShootLinkTable,
} from '@/lib/db/schema';
import { createId } from '@/lib/db/id';
import { getS3, BUCKET } from '@/lib/s3';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { readShootScriptDocument } from '@/lib/shoot-scripts';
import { getDeliverableFolderName } from '@/lib/deliverable-folder-name';

export type FolderCode = 'SF' | 'LF';

/** Maps a deliverable's short code (from generateMonthly.ts's
 * getDeliverableShortCode) to a raw-footage folder code. Returns null for
 * every deliverable type this feature doesn't apply to (thumbnails, tiles,
 * hard posts, etc.) — callers should skip folder creation entirely in
 * that case. */
export function toFolderCode(deliverableSlug: string): FolderCode | null {
  if (deliverableSlug === 'SF') return 'SF';
  if (deliverableSlug === 'LF') return 'LF';
  return null;
}

async function createPhysicalFolder(companyName: string, monthFolder: string, deliverableFolderName: string, code: FolderCode, number: number): Promise<string> {
  const s3 = getS3();
  const folderPath = `${companyName}/raw-footage/${monthFolder}/${deliverableFolderName}/${code}${number}/`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: folderPath, ContentType: 'application/x-directory' }));
  return folderPath;
}

/**
 * Ensures a RawFootageFolder row (+ physical folder) exists for a specific
 * (clientId, monthFolder, code, number) slot, then assigns it to taskId.
 * Called once per deliverable task at creation time (see
 * generateMonthly.ts) — `number` there is the SAME sequential count already
 * used to build the task's title (e.g. SF3), so folder numbering and task
 * naming never drift apart.
 *
 * Safe to call even if the slot already exists (e.g. a re-run) — reuses
 * the existing row and just (re)assigns taskId, rather than creating a
 * duplicate folder.
 */
export async function assignRawFootageFolderForTask(params: {
  clientId: string;
  companyName: string;
  monthFolder: string;
  deliverableSlug: string;
  // Full deliverable type string (e.g. "Short Form Videos"), used to nest
  // the numbered folder inside the same type-named folder the repair tool
  // and every other part of the platform already expects. Falls back to
  // getDeliverableFolderName's default-passthrough behavior if omitted,
  // but callers should always pass the real type string when they have it.
  deliverableType?: string;
  number: number;
  taskId: string;
}): Promise<{ id: string } | null> {
  const code = toFolderCode(params.deliverableSlug);
  if (!code) return null; // not an SF/LF deliverable — nothing to do
  const deliverableFolderName = getDeliverableFolderName(params.deliverableType || (code === 'SF' ? 'Short Form Videos' : 'Long Form Videos'));

  const db = getDbHttp();
  try {
    const [existing] = await db.select().from(rawFootageFolderTable).where(and(
      eq(rawFootageFolderTable.clientId, params.clientId),
      eq(rawFootageFolderTable.monthFolder, params.monthFolder),
      eq(rawFootageFolderTable.code, code),
      eq(rawFootageFolderTable.number, params.number),
    )).limit(1);

    if (existing) {
      await db.update(rawFootageFolderTable).set({ taskId: params.taskId }).where(eq(rawFootageFolderTable.id, existing.id));
      return { id: existing.id };
    }

    const folderPath = await createPhysicalFolder(params.companyName, params.monthFolder, deliverableFolderName, code, params.number);
    const folderId = createId();
    await db.insert(rawFootageFolderTable).values({
      id: folderId,
      clientId: params.clientId,
      monthFolder: params.monthFolder,
      code,
      number: params.number,
      folderPath,
      taskId: params.taskId,
    });
    return { id: folderId };
  } catch (error) {
    // Deliberately swallowed — a folder-creation hiccup should never break
    // the core monthly task-generation run. Logged for later investigation.
    console.error('[raw-footage-folders] assignRawFootageFolderForTask failed:', error);
    return null;
  }
}

/**
 * Manual reassignment (admin/videographer override) — moves a folder slot
 * to point at a different task, or clears it (taskId: null).
 */
export async function reassignRawFootageFolder(folderId: string, taskId: string | null) {
  const db = getDbHttp();
  const [updated] = await db.update(rawFootageFolderTable).set({ taskId }).where(eq(rawFootageFolderTable.id, folderId)).returning();
  return updated ?? null;
}

/**
 * Derives the shoot date(s) a folder should display, via:
 *   Folder.taskId -> Task.shootScriptRef (the native link) and/or any
 *   ScriptShootLink rows targeting shoots this task's script is attached
 *   to -> those shoots' ShootDetail.shootDate.
 * Never reads/writes a stored date on the folder itself — always live.
 * Returns [] (renders as "Unscheduled" by the caller) if the folder has no
 * task yet, or its script isn't attached to any shoot.
 */
export async function getFolderShootDates(taskId: string | null): Promise<string[]> {
  if (!taskId) return [];
  const db = getDbHttp();

  const [task] = await db.select({ shootScriptRef: taskTable.shootScriptRef }).from(taskTable).where(eq(taskTable.id, taskId)).limit(1);
  if (!task?.shootScriptRef) return [];

  let ref: { shootTaskId?: string; scriptId?: string } = {};
  try { ref = JSON.parse(task.shootScriptRef); } catch { return []; }
  if (!ref.shootTaskId || !ref.scriptId) return [];

  // The script's native shoot, plus every additional shoot it's been
  // linked to via ScriptShootLink.
  const linkedTargets = await db.select({ targetShootTaskId: scriptShootLinkTable.targetShootTaskId })
    .from(scriptShootLinkTable)
    .where(and(eq(scriptShootLinkTable.sourceShootTaskId, ref.shootTaskId), eq(scriptShootLinkTable.scriptId, ref.scriptId)));

  const shootTaskIds = [ref.shootTaskId, ...linkedTargets.map((l) => l.targetShootTaskId)];
  const shoots = await db.select({ shootDate: shootDetailTable.shootDate }).from(shootDetailTable).where(inArray(shootDetailTable.taskId, shootTaskIds));

  return shoots.map((s) => s.shootDate).filter((d): d is string => !!d);
}