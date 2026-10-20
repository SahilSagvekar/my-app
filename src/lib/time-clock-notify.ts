// Shared helpers for time-clock Slack notifications (#attendance).
import { sendToChannel } from "@/lib/slack";

/** Hours a clock-in may stay open before it is flagged for a manager. */
export const FORGOT_CLOCK_OUT_AFTER_HOURS = 10;

const ROLE_LABELS: Record<string, string> = {
  editor: "Editor",
  scheduler: "Scheduler",
  videographer: "Videographer",
  qc: "QC",
  sales: "Sales",
  sales_manager: "Sales Manager",
  manager: "Manager",
  admin: "Admin",
  client: "Client",
};

export function roleLabel(role?: string | null): string {
  if (!role) return "Team member";
  const key = role.toLowerCase();
  return (
    ROLE_LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatDuration(fromIso: string, toIso: string): string {
  const mins = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/**
 * Posts to the attendance channel. Returns true only if Slack actually
 * accepted it; never throws (a Slack failure must not undo a clock action).
 */
export async function postAttendance(type: string, message: string): Promise<boolean> {
  try {
    const res = await sendToChannel("attendance", { type, message });
    return !res.missing && res.attempted > 0 && res.failed === 0 && res.succeeded > 0;
  } catch (err) {
    console.error("❌ attendance slack error:", err);
    return false;
  }
}