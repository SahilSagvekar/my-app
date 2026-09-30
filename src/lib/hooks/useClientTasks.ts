import { useCallback, useEffect, useMemo } from 'react';
import useSWR, { type KeyedMutator } from 'swr';
import { preconnectToUrlOrigin } from '../../components/workflow/VideoUrlHelper';

interface TaskFile {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  driveFileId: string;
  mimeType: string;
  size: number;
  folderType?: string;
  version?: number;
  isActive?: boolean;
  replacedAt?: string;
  revisionNote?: string;
  s3Key?: string;
  downloadUrl?: string;
  optimizationStatus?: string;
  optimizationError?: string | null;
}

interface ClientTask {
  id: string;
  title: string;
  description: string;
  taskType: string;
  status: string;
  assignedTo: string;
  createdBy: string;
  clientId: string;
  clientUserId: string;
  driveLinks: string[];
  createdAt: string;
  dueDate: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  taskCategory?: 'design' | 'video' | 'copywriting' | 'review';
  workflowStep?: string;
  folderType?: string;
  qcNotes?: string | null;
  feedback?: string;
  files?: TaskFile[];
  monthlyDeliverable?: any;
  socialMediaLinks?: string[];
  deliverableType?: string;
  // 🔥 Posting title — set by QC, optionally edited by the client before
  // the task is sent on to the scheduler.
  postingTitle?: string | null;
  titleSetByQC?: boolean;
  titleSetByClient?: boolean;
  // 🔥 Multi-item posting content lists (composed in the review sidebar)
  postingTitles?: { id: string; text: string }[];
  postingDescriptions?: { id: string; text: string }[];
  postingTags?: { id: string; text: string }[];
  user?: {
    name: string;
    role: string;
  };
}

// The client Content Review screen used to fetch EVERY task the client has
// (up to 100, all statuses) with all nested data in one request, and only
// then showed the default "pending" tab. It's now split in two:
//
//   1. 'pending' — CLIENT_REVIEW tasks only. This is the first thing on
//      screen, so it loads alone and fast.
//   2. 'others'  — everything else (approved / posted / rejected tab counts
//      and lists). Starts only after (1) has settled so it can't compete
//      with it, and the two are merged back into one `tasks` array so the
//      dashboard keeps working unchanged.
//
// Both use ?light=1, which makes the server skip data this screen never
// reads (feedback threads, shoot details, tags, per-file download URLs, the
// distinct-months scan). See `lightMode` in src/app/api/tasks/route.ts.
type TaskGroup = 'pending' | 'others';

const GROUP_STATUSES: Record<TaskGroup, string> = {
  pending: 'CLIENT_REVIEW',
  others: 'IN_PROGRESS,SCHEDULED,COMPLETED,POSTED,REJECTED_BY_QC,REJECTED_BY_CLIENT',
};

// Sort: Pending first, then Approved, then Posted, then by due date
function sortTasks(tasks: ClientTask[]): ClientTask[] {
  const getOrder = (status: string) => {
    if (status === 'POSTED') return 3;
    if (status === 'COMPLETED' || status === 'SCHEDULED') return 2;
    return 1;
  };

  return [...tasks].sort((a, b) => {
    const orderA = getOrder(a.status);
    const orderB = getOrder(b.status);

    if (orderA !== orderB) return orderA - orderB;

    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

// SWR fetcher with error handling. clientIdOverride is set only when an
// admin/manager is previewing a specific client's portal (see
// useEffectiveClientId) — it's sent both as ?clientId= (which the backend
// uses to scope the query) and as the x-viewing-as header (which the
// backend requires alongside it before it'll treat the caller as "client"
// rather than their real role). A real client user needs neither — the
// backend resolves their own linkedClientId from the session as before.
const fetcher = async ([url, clientIdOverride, group]: [string, string | null, TaskGroup]): Promise<ClientTask[]> => {
  const params = new URLSearchParams();
  params.set('status', GROUP_STATUSES[group]);
  params.set('light', '1');
  if (clientIdOverride) params.set('clientId', clientIdOverride);

  const res = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: clientIdOverride ? { 'x-viewing-as': 'client' } : undefined,
  });

  if (!res.ok) {
    const error = new Error('Failed to fetch tasks');
    throw error;
  }

  const responseData = await res.json();
  let data = responseData.tasks || responseData;

  if (!Array.isArray(data)) {
    console.error('Client API returned non-array:', data);
    return [];
  }

  // Normalize tasks
  const normalized = data.map((task: any) => ({
    ...task,
    status: task.status,
    priority: task.priority || 'medium',
    taskCategory: task.taskCategory || 'design',
    files: task.files || [],
  }));

  return sortTasks(normalized);
};

interface UseClientTasksOptions {
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
  // Pass useEffectiveClientId()'s result here when this hook is used from
  // a page an admin might be previewing as a specific client (currently:
  // ClientDashboard's "Content Review" / approvals tab). Undefined/null
  // for a real client user — the backend falls back to their own session.
  clientIdOverride?: string | null;
}

export function useClientTasks(options: UseClientTasksOptions = {}) {
  const {
    refreshInterval = 0, // No auto-refresh by default
    revalidateOnFocus = true,
    clientIdOverride = null,
  } = options;

  const swrOptions = {
    refreshInterval,
    revalidateOnFocus,
    revalidateOnReconnect: true,
    dedupingInterval: 5000, // Dedupe requests within 5 seconds
    keepPreviousData: true, // Keep showing old data while revalidating
    errorRetryCount: 3,
    errorRetryInterval: 5000,
  };

  const pending = useSWR<ClientTask[]>(
    ['/api/tasks', clientIdOverride, 'pending'] as [string, string | null, TaskGroup],
    fetcher,
    swrOptions
  );

  // Wait for the pending list to settle (success OR error) before starting
  // the second request, so the screen the user is looking at always gets
  // the server and database to itself first.
  const pendingSettled = pending.data !== undefined || !!pending.error;
  const others = useSWR<ClientTask[]>(
    pendingSettled ? (['/api/tasks', clientIdOverride, 'others'] as [string, string | null, TaskGroup]) : null,
    fetcher,
    swrOptions
  );

  const pendingData = pending.data;
  const othersData = others.data;

  // Merge both lists back into the single array the dashboard expects. If a
  // task briefly shows up in both (it changed status between the two
  // fetches), the 'others' copy wins — tasks move forward out of review.
  const data = useMemo(() => {
    if (!pendingData && !othersData) return undefined;
    const byId = new Map<string, ClientTask>();
    for (const t of pendingData ?? []) byId.set(t.id, t);
    for (const t of othersData ?? []) byId.set(t.id, t);
    return sortTasks(Array.from(byId.values()));
  }, [pendingData, othersData]);

  // Same call signature as SWR's own bound mutate, so existing callers —
  // refreshTasks(), refreshTasks(updaterFn), refreshTasks(fn, { revalidate })
  // — keep working. An updater function is applied to each list (they all
  // match tasks by id, so it's a no-op on the list that doesn't hold the
  // task), and a plain refresh revalidates both.
  const mutatePending = pending.mutate;
  const mutateOthers = others.mutate;
  const mutate = useCallback(
    (async (...args: Parameters<KeyedMutator<ClientTask[]>>) => {
      const [first] = await Promise.all([
        (mutatePending as any)(...args),
        (mutateOthers as any)(...args),
      ]);
      return first;
    }) as unknown as KeyedMutator<ClientTask[]>,
    [mutatePending, mutateOthers]
  );

  // Warm up the TLS connection to the video storage host as soon as we know
  // which one it is, so the first click on "Review" doesn't pay for DNS +
  // TCP + TLS before the first video byte.
  const firstStorageUrl = useMemo(
    () => pendingData?.flatMap((t) => t.files || []).find((f) => f.mimeType?.startsWith('video/') && f.url)?.url,
    [pendingData]
  );
  useEffect(() => {
    if (firstStorageUrl) preconnectToUrlOrigin(firstStorageUrl);
  }, [firstStorageUrl]);

  // Check if any tasks have active optimization jobs
  const hasActiveJobs = data?.some(
    (t) => t.files?.some((f) => f.optimizationStatus === 'PROCESSING' || f.optimizationStatus === 'PENDING')
  );

  return {
    tasks: data || [],
    // Only the pending list gates the initial loading state — the other
    // tabs fill in behind it.
    isLoading: pending.isLoading,
    isValidating: pending.isValidating || others.isValidating,
    error: pending.error,
    mutate,
    hasActiveJobs,
  };
}

// Hook for batch presigning video URLs
export function useBatchPresignedUrls(tasks: ClientTask[]) {
  // Collect all S3 file IDs that need presigning
  const fileIds = tasks
    .flatMap((t) => t.files || [])
    .filter((f) => f.s3Key && (f.mimeType?.startsWith('video/') || f.mimeType?.startsWith('image/')))
    .map((f) => f.id);

  const { data, error } = useSWR(
    fileIds.length > 0 ? ['/api/files/batch-presign', fileIds] : null,
    async ([url, ids]) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: ids }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to presign URLs');
      return res.json();
    },
    {
      dedupingInterval: 60000, // Cache presigned URLs for 1 minute
      revalidateOnFocus: false,
    }
  );

  return {
    presignedUrls: data?.urls || {},
    error,
  };
}