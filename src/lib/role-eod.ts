// src/lib/role-eod.ts
// Helper functions for the Scheduler/Videographer EOD Report feature —
// mirrors src/lib/editor-eod.ts's shape, reusing its date/timezone helpers,
// but with eligibility rules suited to each role's actual unit of work
// (a scheduler sets task status, doesn't upload files; a videographer's
// work is a shoot day, not a deliverable task).

import {
  getTodayReportDate,
  formatReportDate,
  isTimestampInEstWorkWindow,
} from "@/lib/editor-eod";

export { getTodayReportDate, formatReportDate };

export interface RoleEodItemEligibility {
  eligible: boolean;
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Scheduler — unit of work is a Task they scheduled/posted today.
// ---------------------------------------------------------------------------
export function validateSchedulerEodEligibility(
  task: {
    id: string;
    scheduler: number | null;
    updatedAt?: string | Date | null;
  },
  currentUserId: number,
  alreadySubmittedTaskIds: Set<string>,
  reportDate: string,
): RoleEodItemEligibility {
  if (task.scheduler !== currentUserId) {
    return { eligible: false, disabledReason: "Not assigned to you" };
  }
  if (alreadySubmittedTaskIds.has(task.id)) {
    return { eligible: false, disabledReason: "Already submitted today" };
  }
  if (!isTimestampInEstWorkWindow(task.updatedAt, reportDate)) {
    return { eligible: false, disabledReason: "Not worked on today (9:00 AM–7:00 PM ET)" };
  }
  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Videographer — unit of work is a shoot day (ShootDetail + Task), not a
// deliverable Task with uploaded files.
// ---------------------------------------------------------------------------
export function validateVideographerEodEligibility(
  shoot: {
    taskId: string;
    videographerId: number | null;
    shootUpdatedAt?: string | Date | null;
    actualEndTime?: string | Date | null;
  },
  currentUserId: number,
  alreadySubmittedTaskIds: Set<string>,
  reportDate: string,
): RoleEodItemEligibility {
  if (shoot.videographerId !== currentUserId) {
    return { eligible: false, disabledReason: "Not assigned to you" };
  }
  if (alreadySubmittedTaskIds.has(shoot.taskId)) {
    return { eligible: false, disabledReason: "Already submitted today" };
  }
  const worked =
    isTimestampInEstWorkWindow(shoot.shootUpdatedAt, reportDate) ||
    isTimestampInEstWorkWindow(shoot.actualEndTime, reportDate);
  if (!worked) {
    return { eligible: false, disabledReason: "Not worked on today (9:00 AM–7:00 PM ET)" };
  }
  return { eligible: true };
}

// ---------------------------------------------------------------------------
// Slack message formatter — generic across both roles.
// ---------------------------------------------------------------------------
export function formatRoleEodSlackMessage(params: {
  roleLabel: string; // "Scheduler" | "Videographer"
  personName: string;
  reportDate: string;
  items: Array<{ title: string; detail?: string | null }>;
  notes?: string;
}): string {
  const { roleLabel, personName, reportDate, items, notes } = params;
  const dateFormatted = formatReportDate(reportDate);

  let message = `📌 *EOD Report — ${personName} (${roleLabel})*\nDate: ${dateFormatted}\n\n✅ *Worked On Today*\n`;

  items.forEach((item, i) => {
    message += `\n${i + 1}. ${item.title}`;
    if (item.detail) message += ` — ${item.detail}`;
    message += "\n";
  });

  if (notes && notes.trim()) {
    message += `\n*Notes:*\n${notes.trim()}\n`;
  }

  message += `\n_Generated from E8 App._`;

  return message;
}
