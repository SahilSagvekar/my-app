// Shared types for the Posting Tracker (admin + scheduler).
// Mirrors the response shape of /api/schedular/daily-targets/progress — keep in sync with that route
// and with DeliverableProgress in src/lib/posting-tracker.ts.

export type DeliverableStatus = 'done' | 'on_track' | 'behind' | 'critical' | 'not_due';

export interface TodayLink {
  id: string;
  url: string;
  title: string | null;
  postedAt: string;
  platform: string;
  taskId: string | null;
}

export interface DeliverableProgress {
  deliverableId: string;
  type: string;
  typeLabel: string;
  isTrial: boolean;
  quantity: number;
  videosPerDay: number;
  postingDays: string[];
  platforms: string[];

  dueToday: number;
  todayPostsRequired: number;
  todayPostsDone: number;
  todayPieces: number;
  readyToPost: number;
  noInventory: boolean;

  monthPosted: number;
  partialPieces: number;
  perPlatform: Record<string, number>;
  expectedByToday: number;
  behindBy: number;
  slotsElapsed: number;
  totalSlots: number;
  slotsLeft: number;
  owed: number;
  cannotFinish: boolean;
  scheduleMismatch: boolean;
  nothingLogged: boolean;
  status: DeliverableStatus;

  todayLinks: TodayLink[];
  partialDetails: { taskId: string; title: string | null; missing: string[] }[];
}

export interface PostingLogDay {
  date: string;
  pieces: number;
  posts: number;
  types: string[];
}

export interface ClientProgress {
  clientId: string;
  clientName: string;
  deliverables: DeliverableProgress[];
  totalRequired: number;
  totalCompleted: number;
  progress: number;
  status: DeliverableStatus;
  noInventoryCount: number;
  behindCount: number;
  log?: PostingLogDay[];
}

export interface ProgressResponse {
  ok: boolean;
  date: string;
  dateKey: string;
  dayOfWeek: number;
  isSunday: boolean;
  grandTotal: number;
  grandCompleted: number;
  grandProgress: number;
  noInventoryCount: number;
  clients: ClientProgress[];
}

export type DailyTargetsRole = 'admin' | 'scheduler';
