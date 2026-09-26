// Posting Tracker engine — derives what each client owes, per Monthly Deliverable,
// and how the scheduler is doing against it. Pure functions (no DB) so the maths
// can be unit-checked and reused by any route.
//
// Model:
//  - Unit = one PIECE of content (one task), posted to EVERY platform the deliverable lists.
//    A piece counts as done only when it is live on all of those platforms.
//  - "Due today" comes from postingDays + videosPerDay (empty postingDays = every day).
//  - Pace = qty * (schedule slots elapsed / total slots this month). Pace decides
//    on-track vs behind; the exact weekday a piece went live does not matter.
//  - Inventory = COMPLETED, not-yet-posted tasks for that client + type. If something
//    is due today and none exist, the row is flagged.
//
// Snapchat is never tracked (matches the old tracker).

import { normalizeDeliverableType } from "@/lib/posting-match";
import { dbTimestampToIso, getESTDateString, getESTParts } from "@/lib/est-date";

export const TRACKED_PLATFORMS = ["instagram", "facebook", "tiktok", "youtube", "linkedin", "twitter"] as const;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Youtube" / "IG (Trials)" / "FB TV" -> one canonical lowercase key, or null if untracked. */
export function canonicalPlatform(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const p = raw.toLowerCase().trim();
  if (p.includes("snap")) return null;
  if (p === "ig" || p.includes("instagram") || p.startsWith("ig ")) return "instagram";
  if (p === "fb" || p.includes("facebook") || p.startsWith("fb ")) return "facebook";
  if (p === "tt" || p.includes("tiktok")) return "tiktok";
  if (p === "yt" || p.includes("youtube")) return "youtube";
  if (p === "li" || p.includes("linkedin")) return "linkedin";
  if (p === "x" || p.includes("twitter")) return "twitter";
  return null;
}

export interface TrackerDeliverableInput {
  id: string;
  type: string;
  quantity: number;
  videosPerDay: number;
  postingDays: string[] | null;
  platforms: string[] | null;
  isTrial: boolean;
}

export interface TrackerPostInput {
  id: string;
  taskId: string | null;
  platform: string;
  deliverableType: string | null;
  url: string;
  title: string | null;
  postedAt: string;
}

export type DeliverableStatus = "done" | "on_track" | "behind" | "critical" | "not_due";

export interface PieceLog {
  date: string; // YYYY-MM-DD (EST)
  pieces: number;
  posts: number;
  types: string[];
}

export interface DeliverableProgress {
  deliverableId: string;
  type: string; // normalized short code (SF, HP, ...)
  typeLabel: string; // as entered on the deliverable
  isTrial: boolean;
  quantity: number;
  videosPerDay: number;
  postingDays: string[]; // [] = every day
  platforms: string[]; // canonical keys

  // today
  dueToday: number; // pieces due today
  todayPostsRequired: number; // dueToday * platforms
  todayPostsDone: number;
  todayPieces: number;
  readyToPost: number; // COMPLETED, unposted tasks available to the scheduler
  noInventory: boolean; // due today, not yet met, and nothing ready

  // month to date
  monthPosted: number; // pieces live on ALL platforms
  partialPieces: number; // posted somewhere but not everywhere
  perPlatform: Record<string, number>;
  expectedByToday: number;
  behindBy: number; // max(0, expected - posted)
  slotsElapsed: number;
  totalSlots: number;
  slotsLeft: number; // slots from today onward not yet used today
  owed: number; // pieces still needed to hit quota
  cannotFinish: boolean; // owed > slotsLeft
  scheduleMismatch: boolean; // schedule can't even fit the quota
  nothingLogged: boolean; // pace says we should have something, and zero posts exist
  status: DeliverableStatus;

  todayLinks: { id: string; url: string; title: string | null; postedAt: string; platform: string; taskId: string | null }[];
  partialDetails: { taskId: string; title: string | null; missing: string[] }[];
}

export interface DeliverableComputeContext {
  /** Any instant inside the selected EST day. */
  date?: string;
  /** Completed-and-unposted task counts keyed by normalized deliverable type. */
  readyByType: Map<string, number>;
  /** ALL posts for this client in the selected EST month. */
  posts: TrackerPostInput[];
}

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function isScheduledDay(postingDays: string[], weekday: number): boolean {
  return postingDays.length === 0 || postingDays.includes(WEEKDAYS[weekday]);
}

export function computeDeliverableProgress(
  d: TrackerDeliverableInput,
  ctx: DeliverableComputeContext
): DeliverableProgress | null {
  const type = normalizeDeliverableType(d.type);
  if (d.type.toLowerCase().includes("snapchat")) return null;

  const platforms = [...new Set((d.platforms ?? []).map(canonicalPlatform).filter((p): p is string => !!p))];
  if (platforms.length === 0) return null;

  const now = ctx.date ? new Date(ctx.date) : new Date();
  const { year, month, day: today, weekday: todayWeekday } = getESTParts(now);
  const todayKey = getESTDateString(ctx.date);
  const dim = daysInMonth(year, month);
  const postingDays = (d.postingDays ?? []).filter(Boolean);
  const vpd = Math.max(1, d.videosPerDay || 1);

  // Schedule slots this month.
  let scheduledDays = 0;
  let scheduledDaysElapsed = 0; // through today, inclusive
  let scheduledDaysFromToday = 0; // from today, inclusive
  for (let day = 1; day <= dim; day++) {
    const wd = new Date(Date.UTC(year, month, day)).getUTCDay();
    if (!isScheduledDay(postingDays, wd)) continue;
    scheduledDays++;
    if (day <= today) scheduledDaysElapsed++;
    if (day >= today) scheduledDaysFromToday++;
  }
  const totalSlots = scheduledDays * vpd;
  const slotsElapsed = scheduledDaysElapsed * vpd;

  // Group this deliverable's posts into pieces (by task).
  const pieces = new Map<
    string,
    { platforms: Set<string>; dates: Set<string>; title: string | null; count: number }
  >();
  const todayLinks: DeliverableProgress["todayLinks"] = [];
  const perPlatform: Record<string, number> = Object.fromEntries(platforms.map((p) => [p, 0]));
  let todayPostsDone = 0;
  const todayPieceIds = new Set<string>();

  for (const p of ctx.posts) {
    if (normalizeDeliverableType(p.deliverableType) !== type) continue;
    const plat = canonicalPlatform(p.platform);
    if (!plat) continue;
    const key = p.taskId ?? p.id;
    const dateKey = getESTDateString(dbTimestampToIso(p.postedAt));
    let piece = pieces.get(key);
    if (!piece) {
      piece = { platforms: new Set(), dates: new Set(), title: p.title, count: 0 };
      pieces.set(key, piece);
    }
    piece.platforms.add(plat);
    piece.dates.add(dateKey);
    piece.count++;
    if (plat in perPlatform) perPlatform[plat]++;
    if (dateKey === todayKey) {
      todayLinks.push({
        id: p.id,
        url: p.url,
        title: p.title,
        postedAt: p.postedAt,
        platform: plat,
        taskId: p.taskId,
      });
      if (platforms.includes(plat)) todayPostsDone++;
      todayPieceIds.add(key);
    }
  }

  let monthPosted = 0;
  let partialPieces = 0;
  const partialDetails: DeliverableProgress["partialDetails"] = [];
  for (const [taskId, piece] of pieces) {
    const missing = platforms.filter((pl) => !piece.platforms.has(pl));
    if (missing.length === 0) monthPosted++;
    else {
      partialPieces++;
      partialDetails.push({ taskId, title: piece.title, missing });
    }
  }

  // Today.
  const dueTodayRaw = isScheduledDay(postingDays, todayWeekday) ? vpd : 0;
  const owed = Math.max(0, d.quantity - monthPosted);
  const quotaMet = owed === 0;
  const dueToday = quotaMet ? 0 : dueTodayRaw;
  const todayPostsRequired = dueToday * platforms.length;
  const todayPostsDoneCapped = Math.min(todayPostsDone, todayPostsRequired);
  const todayMet = dueToday === 0 || todayPostsDone >= todayPostsRequired;

  const readyToPost = ctx.readyByType.get(type) ?? 0;
  const noInventory = dueToday > 0 && !todayMet && readyToPost === 0;

  // Pace.
  const expectedByToday = totalSlots > 0 ? Math.round((d.quantity * slotsElapsed) / totalSlots) : 0;
  const behindBy = Math.max(0, expectedByToday - monthPosted);

  const piecesPostedToday = todayPieceIds.size;
  const slotsLeft = Math.max(0, scheduledDaysFromToday * vpd - Math.min(piecesPostedToday, dueTodayRaw));
  const cannotFinish = owed > slotsLeft;
  const scheduleMismatch = totalSlots < d.quantity;
  const nothingLogged = pieces.size === 0 && expectedByToday >= 1;

  let status: DeliverableStatus;
  if (quotaMet) status = "done";
  else if (behindBy === 0) status = dueToday === 0 ? "not_due" : "on_track";
  else if (behindBy >= Math.max(3, Math.ceil(d.quantity * 0.25))) status = "critical";
  else status = "behind";
  // "on_track" when nothing due today but on pace reads better as on_track than not_due
  if (status === "not_due") status = "on_track";

  return {
    deliverableId: d.id,
    type,
    typeLabel: d.type,
    isTrial: d.isTrial,
    quantity: d.quantity,
    videosPerDay: vpd,
    postingDays,
    platforms,
    dueToday,
    todayPostsRequired,
    todayPostsDone: todayPostsDoneCapped,
    todayPieces: piecesPostedToday,
    readyToPost,
    noInventory,
    monthPosted,
    partialPieces,
    perPlatform,
    expectedByToday,
    behindBy,
    slotsElapsed,
    totalSlots,
    slotsLeft,
    owed,
    cannotFinish,
    scheduleMismatch,
    nothingLogged,
    status,
    todayLinks,
    partialDetails,
  };
}

/** Per-day posting log for the month — used by the client drawer. */
export function buildPostingLog(posts: TrackerPostInput[]): PieceLog[] {
  const byDay = new Map<string, { pieces: Set<string>; posts: number; types: Set<string> }>();
  for (const p of posts) {
    if (!canonicalPlatform(p.platform)) continue;
    const dateKey = getESTDateString(dbTimestampToIso(p.postedAt));
    let day = byDay.get(dateKey);
    if (!day) {
      day = { pieces: new Set(), posts: 0, types: new Set() };
      byDay.set(dateKey, day);
    }
    day.pieces.add(p.taskId ?? p.id);
    day.posts++;
    day.types.add(normalizeDeliverableType(p.deliverableType));
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, pieces: v.pieces.size, posts: v.posts, types: [...v.types] }));
}
