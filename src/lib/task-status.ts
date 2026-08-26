// Shared TaskStatus helpers for rejected split + display labels
export const REJECTED_BY_QC = "REJECTED_BY_QC" as const;
export const REJECTED_BY_CLIENT = "REJECTED_BY_CLIENT" as const;

/** Both rejection statuses (and legacy REJECTED during/after migration). */
export const REJECTED_STATUSES = [
  REJECTED_BY_QC,
  REJECTED_BY_CLIENT,
  "REJECTED", // legacy — migrate DB rows to REJECTED_BY_QC
] as const;

export type RejectedTaskStatus = typeof REJECTED_BY_QC | typeof REJECTED_BY_CLIENT;

export function isRejectedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (
    status === REJECTED_BY_QC ||
    status === REJECTED_BY_CLIENT ||
    status === "REJECTED"
  );
}

/** Map actor role → which rejected status to store. Scheduler/QC/admin → BY_QC; client → BY_CLIENT. */
export function rejectionStatusForRole(role: string | null | undefined): RejectedTaskStatus {
  if ((role || "").toLowerCase() === "client") return REJECTED_BY_CLIENT;
  return REJECTED_BY_QC;
}

/**
 * Normalize an incoming status write:
 * - any rejection value → role-based REJECTED_BY_QC / REJECTED_BY_CLIENT
 */
export function normalizeIncomingTaskStatus(
  status: string,
  role: string | null | undefined
): string {
  if (isRejectedStatus(status)) {
    return rejectionStatusForRole(role);
  }
  return status;
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  READY_FOR_QC: "Quality Control",
  QC_IN_PROGRESS: "QC In Progress",
  COMPLETED: "Completed",
  SCHEDULED: "Scheduled",
  ON_HOLD: "On Hold",
  REJECTED: "Rejected by QC", // legacy display
  REJECTED_BY_QC: "Rejected by QC",
  REJECTED_BY_CLIENT: "Rejected by Client",
  CLIENT_REVIEW: "Client Review",
  VIDEOGRAPHER_ASSIGNED: "Videographer Assigned",
  POSTED: "Posted",
  HIDDEN: "Hidden",
};

export function getTaskStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return TASK_STATUS_LABELS[status] || status;
}
