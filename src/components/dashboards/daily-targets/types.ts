// Shared types for the Daily Posting Tracker (admin + scheduler).
// Mirrors the response shape of /api/schedular/daily-targets/progress — keep in sync with that route.

export interface PostLink {
  id: string;
  url: string;
  title: string | null;
  postedAt: string;
  taskId: string | null;
}

export interface DeliverableProgress {
  deliverableType: string;
  required: number;
  frequency: string;
  isActive: boolean;
  completed: number;
  remaining: number;
  monthlyAccomplished: boolean;
  monthlyRequired: number | null;
  monthlyCompleted: number;
  extras: { tiles?: boolean; thumb?: boolean; note?: string } | null;
  links: PostLink[];
}

export interface PlatformProgress {
  platform: string;
  deliverables: DeliverableProgress[];
  totalRequired: number;
  totalCompleted: number;
  progress: number;
}

export interface ClientProgress {
  clientId: string;
  clientName: string;
  platforms: PlatformProgress[];
  totalRequired: number;
  totalCompleted: number;
  progress: number;
}

export interface ProgressResponse {
  ok: boolean;
  date: string;
  dayOfWeek: number;
  isSunday: boolean;
  grandTotal: number;
  grandCompleted: number;
  grandProgress: number;
  clients: ClientProgress[];
}

export type DailyTargetsRole = 'admin' | 'scheduler';
