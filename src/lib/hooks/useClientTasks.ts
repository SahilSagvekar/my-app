import useSWR from 'swr';

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

// SWR fetcher with error handling. clientIdOverride is set only when an
// admin/manager is previewing a specific client's portal (see
// useEffectiveClientId) — it's sent both as ?clientId= (which the backend
// uses to scope the query) and as the x-viewing-as header (which the
// backend requires alongside it before it'll treat the caller as "client"
// rather than their real role). A real client user needs neither — the
// backend resolves their own linkedClientId from the session as before.
const fetcher = async ([url, clientIdOverride]: [string, string | null]): Promise<ClientTask[]> => {
  const fetchUrl = clientIdOverride ? `${url}?clientId=${clientIdOverride}` : url;
  const res = await fetch(fetchUrl, {
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

  // Sort: Pending first, then Approved, then Posted, then by due date
  return normalized.sort((a: ClientTask, b: ClientTask) => {
    const getOrder = (status: string) => {
      if (status === 'POSTED') return 3;
      if (status === 'COMPLETED' || status === 'SCHEDULED') return 2;
      return 1;
    };

    const orderA = getOrder(a.status);
    const orderB = getOrder(b.status);

    if (orderA !== orderB) return orderA - orderB;

    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
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

  const { data, error, isLoading, isValidating, mutate } = useSWR<ClientTask[]>(
    ['/api/tasks', clientIdOverride],
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      keepPreviousData: true, // Keep showing old data while revalidating
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  // Check if any tasks have active optimization jobs
  const hasActiveJobs = data?.some(
    (t) => t.files?.some((f) => f.optimizationStatus === 'PROCESSING' || f.optimizationStatus === 'PENDING')
  );

  return {
    tasks: data || [],
    isLoading,
    isValidating,
    error,
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