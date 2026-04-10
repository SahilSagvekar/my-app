type MonthlyDeliverableSource = {
  id: string;
  type: string;
  quantity: number;
  platforms: string[];
};

type ClientSource = {
  id: string;
  name: string;
  companyName: string | null;
  requiresClientReview: boolean;
  monthlyDeliverables: MonthlyDeliverableSource[];
};

type TaskSource = {
  id: string;
  title?: string | null;
  clientId: string | null;
  monthlyDeliverableId: string | null;
  oneOffDeliverableId?: string | null;
  deliverableType?: string | null;
  taskType?: string | null;
  status: string | null;
  dueDate: Date | null;
  recurringMonth: string | null;
};

export interface DeliverableMilestoneProgress {
  id: string;
  type: string;
  platforms: string[];
  targetQuantity: number;
  qcCleared: number;
  clientApproved: number;
  clientApprovalApplicable: boolean;
  scheduledOrPosted: number;
  behindScheduleCount: number;
  matchedTaskCount: number;
}

export interface ClientMilestoneProgress {
  clientId: string;
  clientName: string;
  clientApprovalApplicable: boolean;
  targetQuantity: number;
  qcCleared: number;
  clientApproved: number;
  scheduledOrPosted: number;
  behindScheduleCount: number;
  deliverables: DeliverableMilestoneProgress[];
}

type BuilderDiagnostics = {
  skippedOneOff: number;
  unmatchedTasks: string[];
  ambiguousTasks: string[];
  missingLinkedDeliverables: string[];
};

const QC_CLEARED_STATUSES = new Set(["CLIENT_REVIEW", "COMPLETED", "SCHEDULED", "POSTED"]);
const CLIENT_APPROVED_STATUSES = new Set(["COMPLETED", "SCHEDULED", "POSTED"]);
const POSTING_STATUSES = new Set(["SCHEDULED", "POSTED"]);
const MAX_DIAGNOSTIC_SAMPLES = 8;

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonthKey(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }

  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return false;
  }

  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function formatMonthLabel(monthKey: string, locale = "en-US"): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function getMonthDateRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export function getTaskCycleMonthKey(task: Pick<TaskSource, "recurringMonth" | "dueDate">): string | null {
  if (task.recurringMonth) {
    return task.recurringMonth;
  }

  if (!task.dueDate) {
    return null;
  }

  return getMonthKey(task.dueDate);
}

export function isQcClearedStatus(status: string | null | undefined): boolean {
  return QC_CLEARED_STATUSES.has(status || "");
}

export function isClientApprovedStatus(status: string | null | undefined): boolean {
  return CLIENT_APPROVED_STATUSES.has(status || "");
}

export function isScheduledOrPostedStatus(status: string | null | undefined): boolean {
  return POSTING_STATUSES.has(status || "");
}

function normalizeDeliverableType(value: string | null | undefined): string {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pushDiagnosticSample(bucket: string[], taskId: string) {
  if (bucket.length < MAX_DIAGNOSTIC_SAMPLES) {
    bucket.push(taskId);
  }
}

function buildUniqueTypeIndex(deliverables: MonthlyDeliverableSource[]) {
  const index = new Map<string, string | null>();

  for (const deliverable of deliverables) {
    const normalizedType = normalizeDeliverableType(deliverable.type);
    if (!normalizedType) {
      continue;
    }

    if (!index.has(normalizedType)) {
      index.set(normalizedType, deliverable.id);
      continue;
    }

    index.set(normalizedType, null);
  }

  return index;
}

function resolveDeliverableIdForTask(
  task: TaskSource,
  deliverableById: Map<string, DeliverableMilestoneProgress>,
  uniqueTypeIndex: Map<string, string | null>,
  diagnostics: BuilderDiagnostics
) {
  if (task.oneOffDeliverableId) {
    diagnostics.skippedOneOff += 1;
    return null;
  }

  if (task.monthlyDeliverableId) {
    if (deliverableById.has(task.monthlyDeliverableId)) {
      return task.monthlyDeliverableId;
    }

    pushDiagnosticSample(diagnostics.missingLinkedDeliverables, task.id);
  }

  const normalizedType = normalizeDeliverableType(task.deliverableType || task.taskType);
  if (!normalizedType) {
    pushDiagnosticSample(diagnostics.unmatchedTasks, task.id);
    return null;
  }

  const matchedDeliverableId = uniqueTypeIndex.get(normalizedType);
  if (matchedDeliverableId === undefined) {
    pushDiagnosticSample(diagnostics.unmatchedTasks, task.id);
    return null;
  }

  if (matchedDeliverableId === null) {
    pushDiagnosticSample(diagnostics.ambiguousTasks, task.id);
    return null;
  }

  return matchedDeliverableId;
}

function logDiagnostics(
  logPrefix: string,
  monthKey: string,
  client: Pick<ClientSource, "id" | "name" | "companyName">,
  diagnostics: BuilderDiagnostics
) {
  const hasDiagnostics =
    diagnostics.skippedOneOff > 0 ||
    diagnostics.unmatchedTasks.length > 0 ||
    diagnostics.ambiguousTasks.length > 0 ||
    diagnostics.missingLinkedDeliverables.length > 0;

  if (!hasDiagnostics) {
    return;
  }

  console.warn(`${logPrefix} Progress mapping diagnostics for ${monthKey}`, {
    clientId: client.id,
    clientName: client.companyName || client.name,
    skippedOneOff: diagnostics.skippedOneOff,
    unmatchedTaskIds: diagnostics.unmatchedTasks,
    ambiguousTaskIds: diagnostics.ambiguousTasks,
    missingLinkedDeliverableTaskIds: diagnostics.missingLinkedDeliverables,
  });
}

export function buildCurrentMonthClientDeliverablesProgress({
  clients,
  tasks,
  now = new Date(),
  monthKey,
  logPrefix = "[MONTHLY_DELIVERABLES_PROGRESS]",
}: {
  clients: ClientSource[];
  tasks: TaskSource[];
  now?: Date;
  monthKey?: string;
  logPrefix?: string;
}): ClientMilestoneProgress[] {
  const currentMonthKey = monthKey || getMonthKey(now);
  const tasksByClient = new Map<string, TaskSource[]>();

  for (const task of tasks) {
    if (!task.clientId) {
      continue;
    }

    const cycleMonthKey = getTaskCycleMonthKey(task);
    if (cycleMonthKey !== currentMonthKey) {
      continue;
    }

    const existing = tasksByClient.get(task.clientId) || [];
    existing.push(task);
    tasksByClient.set(task.clientId, existing);
  }

  return clients.map((client) => {
    const deliverables = client.monthlyDeliverables.map<DeliverableMilestoneProgress>((deliverable) => ({
      id: deliverable.id,
      type: deliverable.type,
      platforms: deliverable.platforms,
      targetQuantity: deliverable.quantity || 0,
      qcCleared: 0,
      clientApproved: 0,
      clientApprovalApplicable: client.requiresClientReview,
      scheduledOrPosted: 0,
      behindScheduleCount: 0,
      matchedTaskCount: 0,
    }));

    const deliverableById = new Map(deliverables.map((deliverable) => [deliverable.id, deliverable]));
    const uniqueTypeIndex = buildUniqueTypeIndex(client.monthlyDeliverables);
    const diagnostics: BuilderDiagnostics = {
      skippedOneOff: 0,
      unmatchedTasks: [],
      ambiguousTasks: [],
      missingLinkedDeliverables: [],
    };

    for (const task of tasksByClient.get(client.id) || []) {
      const deliverableId = resolveDeliverableIdForTask(task, deliverableById, uniqueTypeIndex, diagnostics);
      if (!deliverableId) {
        continue;
      }

      const deliverable = deliverableById.get(deliverableId);
      if (!deliverable) {
        continue;
      }

      deliverable.matchedTaskCount += 1;

      if (isQcClearedStatus(task.status)) {
        deliverable.qcCleared += 1;
      }

      if (client.requiresClientReview && isClientApprovedStatus(task.status)) {
        deliverable.clientApproved += 1;
      }

      if (isScheduledOrPostedStatus(task.status)) {
        deliverable.scheduledOrPosted += 1;
      }

      if (task.dueDate && task.dueDate < now && !isScheduledOrPostedStatus(task.status)) {
        deliverable.behindScheduleCount += 1;
      }
    }

    logDiagnostics(logPrefix, currentMonthKey, client, diagnostics);

    return {
      clientId: client.id,
      clientName: client.companyName || client.name,
      clientApprovalApplicable: client.requiresClientReview,
      targetQuantity: deliverables.reduce((sum, deliverable) => sum + deliverable.targetQuantity, 0),
      qcCleared: deliverables.reduce((sum, deliverable) => sum + deliverable.qcCleared, 0),
      clientApproved: deliverables.reduce((sum, deliverable) => sum + deliverable.clientApproved, 0),
      scheduledOrPosted: deliverables.reduce((sum, deliverable) => sum + deliverable.scheduledOrPosted, 0),
      behindScheduleCount: deliverables.reduce((sum, deliverable) => sum + deliverable.behindScheduleCount, 0),
      deliverables,
    };
  });
}
