// src/lib/editor-eod.ts
// Helper functions for Editor EOD Report feature

import { getFileUrl } from "@/lib/s3";
import { EST_TIMEZONE, estWallClockToUTC } from "@/lib/timezone";
import { getESTDateString } from "@/lib/est-date";

/** EOD work window in US Eastern: 9:00 AM – 7:00 PM inclusive. */
export const EOD_WORK_WINDOW = { startHour: 9, endHour: 19 } as const;

// ---------------------------------------------------------------------------
// Date helper — returns "YYYY-MM-DD" in America/New_York (EST/EDT)
// ---------------------------------------------------------------------------
export function getTodayReportDate(): string {
  return getESTDateString();
}

export function formatReportDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: EST_TIMEZONE,
  });
}

/** UTC bounds for today's EOD work window (9am–7pm ET on reportDate). */
export function getEstWorkWindowBounds(reportDate: string): { start: Date; end: Date } {
  return {
    start: new Date(
      estWallClockToUTC(
        `${reportDate}T${String(EOD_WORK_WINDOW.startHour).padStart(2, "0")}:00:00`,
      ),
    ),
    end: new Date(
      estWallClockToUTC(
        `${reportDate}T${String(EOD_WORK_WINDOW.endHour).padStart(2, "0")}:00:00`,
      ),
    ),
  };
}

export function isTimestampInEstWorkWindow(
  value: string | Date | null | undefined,
  reportDate: string,
): boolean {
  if (!value) return false;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return false;
  const { start, end } = getEstWorkWindowBounds(reportDate);
  return t >= start.getTime() && t <= end.getTime();
}

/**
 * True if the editor had work activity on this task during today's
 * 9am–7pm ET window — either a file upload or a task update in that range.
 */
export function taskWorkedInEstWindow(
  task: {
    updatedAt?: string | Date | null;
    files?: Array<{ uploadedAt?: string | Date | null; isActive?: boolean | null }>;
  },
  reportDate: string,
): boolean {
  if (isTimestampInEstWorkWindow(task.updatedAt, reportDate)) return true;
  return (task.files || []).some(
    (f) => f.isActive !== false && isTimestampInEstWorkWindow(f.uploadedAt, reportDate),
  );
}

// ---------------------------------------------------------------------------
// Extract proof/output links from a task's files
// ---------------------------------------------------------------------------
export interface ProofLink {
  name: string;
  url: string;
  type: "video" | "image" | "file";
}

export function extractTaskProofLinks(
  task: {
    files?: Array<{
      s3Key?: string | null;
      url?: string;
      name: string;
      mimeType?: string | null;
      folderType?: string | null;
      isActive?: boolean;
    }>;
    driveLinks?: string[];
  },
): ProofLink[] {
  const links: ProofLink[] = [];

  // From uploaded files (R2/S3)
  if (task.files) {
    for (const file of task.files) {
      if (file.isActive === false) continue;

      let url = "";
      if (file.s3Key) {
        url = getFileUrl(file.s3Key);
      } else if (file.url) {
        url = file.url;
      }

      if (!url) continue;

      const type = file.mimeType?.startsWith("video/")
        ? "video"
        : file.mimeType?.startsWith("image/")
          ? "image"
          : "file";

      links.push({ name: file.name, url, type });
    }
  }

  // From drive links
  if (task.driveLinks) {
    for (const link of task.driveLinks) {
      if (link && link.trim()) {
        links.push({ name: "Google Drive Link", url: link.trim(), type: "file" });
      }
    }
  }

  return links;
}

// ---------------------------------------------------------------------------
// Validate task eligibility for EOD report
// ---------------------------------------------------------------------------
export interface EodTaskEligibility {
  eligible: boolean;
  disabledReason?: string;
}

export function validateEodTaskEligibility(
  task: {
    id: string;
    assignedTo: number;
    updatedAt?: string | Date | null;
    files?: Array<{
      s3Key?: string | null;
      url?: string;
      isActive?: boolean;
      uploadedAt?: string | Date | null;
    }>;
    driveLinks?: string[];
  },
  currentUserId: number,
  alreadySubmittedTaskIds: Set<string>,
  reportDate: string,
): EodTaskEligibility {
  // Check assignment
  if (task.assignedTo !== currentUserId) {
    return { eligible: false, disabledReason: "Not assigned to you" };
  }

  // Check already submitted
  if (alreadySubmittedTaskIds.has(task.id)) {
    return { eligible: false, disabledReason: "Already submitted today" };
  }

  // Only tasks worked on today during 9am–7pm ET
  if (!taskWorkedInEstWindow(task, reportDate)) {
    return {
      eligible: false,
      disabledReason: "Not worked on today (9:00 AM–7:00 PM ET)",
    };
  }

  // Check proof links
  const hasFiles = task.files?.some(
    (f) => f.isActive !== false && (f.s3Key || f.url),
  );
  const hasDriveLinks = task.driveLinks?.some((l) => l && l.trim());

  if (!hasFiles && !hasDriveLinks) {
    return { eligible: false, disabledReason: "No output link found" };
  }

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Format Slack message for EOD report
// ---------------------------------------------------------------------------
export function formatEditorEodSlackMessage(params: {
  editorName: string;
  reportDate: string;
  tasks: Array<{
    title: string;
    proofLinks: ProofLink[];
  }>;
  notes?: string;
}): string {
  const { editorName, reportDate, tasks, notes } = params;
  const dateFormatted = formatReportDate(reportDate);

  let message = `📌 *EOD Report — ${editorName}*\nDate: ${dateFormatted}\n\n✅ *Tasks Completed / Worked On*\n`;

  tasks.forEach((task, i) => {
    message += `\n${i + 1}. ${task.title}`;
    message += "\n";
  });

  if (notes && notes.trim()) {
    message += `\n*Notes:*\n${notes.trim()}\n`;
  }

  message += `\n_Generated from E8 App._`;

  return message;
}
