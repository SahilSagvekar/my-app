// src/lib/task-transitions.ts
export const UI_TRANSITIONS = {
  PENDING: [{ label: "Start Task", next: "IN_PROGRESS" }],
  IN_PROGRESS: [{ label: "Mark Ready for QC", next: "READY_FOR_QC" }, { label: "Put On Hold", next: "ON_HOLD" }],
  READY_FOR_QC: [{ label: "Start QC", next: "QC_IN_PROGRESS" }],
  QC_IN_PROGRESS: [{ label: "Approve", next: "COMPLETED" }, { label: "Reject (Send Back)", next: "REJECTED" }],
};
