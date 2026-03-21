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
  user?: {
    name: string;
    role: string;
  };
}

// SWR fetcher with error handling
const fetcher = async (url: string): Promise<ClientTask[]> => {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
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
}

export function useClientTasks(options: UseClientTasksOptions = {}) {
  const {
    refreshInterval = 0, // No auto-refresh by default
    revalidateOnFocus = true,
  } = options;

  const { data, error, isLoading, isValidating, mutate } = useSWR<ClientTask[]>(
    '/api/tasks',
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
