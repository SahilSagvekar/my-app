// src/lib/editor-eod.ts
// Helper functions for Editor EOD Report feature

import { getFileUrl } from "@/lib/s3";

// ---------------------------------------------------------------------------
// Date helper — returns "YYYY-MM-DD" in Asia/Kolkata timezone
// ---------------------------------------------------------------------------
export function getTodayReportDate(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now); // "YYYY-MM-DD"
}

export function formatReportDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
  }
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
    files?: Array<{ s3Key?: string | null; url?: string; isActive?: boolean }>;
    driveLinks?: string[];
  },
  currentUserId: number,
  alreadySubmittedTaskIds: Set<string>
): EodTaskEligibility {
  // Check assignment
  if (task.assignedTo !== currentUserId) {
    return { eligible: false, disabledReason: "Not assigned to you" };
  }

  // Check already submitted
  if (alreadySubmittedTaskIds.has(task.id)) {
    return { eligible: false, disabledReason: "Already submitted today" };
  }

  // Check proof links
  const hasFiles = task.files?.some(
    (f) => f.isActive !== false && (f.s3Key || f.url)
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