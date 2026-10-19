import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR, { type KeyedMutator } from 'swr';
import useSWRInfinite from 'swr/infinite';
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
  // 🔴 Persistent client-rejection tracking (see Task.clientRejectionCount)
  clientRejectionCount?: number;
  lastClientRejectedAt?: string | null;
  isFinalRevision?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Review tabs
//
//   Pending  — CLIENT_REVIEW tasks. Loaded first and on its own, one request.
//   Approved — COMPLETED tasks, loaded a page at a time ("Load more").
//   Posted   — POSTED + SCHEDULED tasks, a page at a time.
//   Rejected — EVERY task the client has ever rejected (clientRejectionCount
//              > 0), in ANY status, a page at a time. A rejected task stays
//              here while the editor fixes it, while QC checks it, and after
//              it is approved / posted again.
//
// Why this replaced the old "pending + one big 'others' request" split: the
// old second request mixed Approved, Posted and Rejected (plus statuses no tab
// shows) under one hard 100-row cap, so older tasks silently vanished, the tab
// counts undercounted, and if that request failed all three tabs just showed 0
// with no error. Now each tab has its own paged request, the badges come from a
// separate cheap count request (so they are exact), and every failure is
// exposed so the screen can show it with a retry.
//
// All requests use ?light=1, which makes the server skip data this screen never
// reads (feedback threads, shoot details, tags, per-file download URLs, the
// distinct-months scan). See `lightMode` in src/app/api/tasks/route.ts.
// ─────────────────────────────────────────────────────────────────────────────
export type ClientTab = 'pending' | 'approved' | 'posted' | 'rejected';
export type PagedClientTab = Exclude<ClientTab, 'pending'>;
export type ClientTabCounts = Record<ClientTab, number | null>;

export const CLIENT_TAB_PAGE_SIZE = 24;

const PAGED_TABS: PagedClientTab[] = ['approved', 'posted', 'rejected'];

interface TabPage {
  tasks: ClientTask[];
  total: number;
  hasMore: boolean;
}

export interface ClientTabState {
  /** First page is loading (nothing to show yet). */
  isLoading: boolean;
  /** A further page is loading after "Load more". */
  isLoadingMore: boolean;
  /** Set when a request failed and there is nothing loaded to show. */
  error: Error | null;
  hasMore: boolean;
  /** Total tasks in this tab on the server (not just the pages loaded). */
  total: number | null;
  loadMore: () => void;
  retry: () => void;
}

// Sort used for the Pending tab only: by due date. The paged tabs keep the
// order the server returns them in, so pages never repeat or skip a row.
function sortPendingTasks(tasks: ClientTask[]): ClientTask[] {
  return [...tasks].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
}

function dedupeById(tasks: ClientTask[]): ClientTask[] {
  const byId = new Map<string, ClientTask>();
  for (const t of tasks) byId.set(t.id, t);
  return Array.from(byId.values());
}

// Shared request helper. clientIdOverride is set only when an admin/manager is
// previewing a specific client's portal (see useEffectiveClientId) — it's sent
// both as ?clientId= (which the backend uses to scope the query) and as the
// x-viewing-as header (which the backend requires alongside it before it'll
// treat the caller as "client" rather than their real role). A real client user
// needs neither — the backend resolves their own client from the session.
async function requestTasks(
  params: URLSearchParams,
  clientIdOverride: string | null,
): Promise<any> {
  if (clientIdOverride) params.set('clientId', clientIdOverride);

  const res = await fetch(`/api/tasks?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
    headers: clientIdOverride ? { 'x-viewing-as': 'client' } : undefined,
  });

  if (!res.ok) {
    throw new Error('Failed to fetch tasks');
  }
  return res.json();
}

function normalizeTasks(responseData: any): ClientTask[] {
  const data = responseData?.tasks || responseData;

  if (!Array.isArray(data)) {
    console.error('Client API returned non-array:', data);
    return [];
  }

  return data.map((task: any) => ({
    ...task,
    status: task.status,
    priority: task.priority || 'medium',
    taskCategory: task.taskCategory || 'design',
    files: task.files || [],
  }));
}

// Pending tab: CLIENT_REVIEW tasks, one request, no paging.
const pendingFetcher = async ([, clientIdOverride]: [string, string | null, 'pending']): Promise<ClientTask[]> => {
  const params = new URLSearchParams();
  params.set('status', 'CLIENT_REVIEW');
  params.set('light', '1');
  return sortPendingTasks(normalizeTasks(await requestTasks(params, clientIdOverride)));
};

// Approved / Posted / Rejected tabs: one page per request.
const tabPageFetcher = async ([, clientIdOverride, tab, offset]: readonly [
  string,
  string | null,
  PagedClientTab,
  number,
]): Promise<TabPage> => {
  const params = new URLSearchParams();
  params.set('light', '1');
  params.set('withTotal', '1');
  params.set('limit', String(CLIENT_TAB_PAGE_SIZE));
  if (offset > 0) params.set('offset', String(offset));

  if (tab === 'approved') params.set('status', 'COMPLETED');
  else if (tab === 'posted') params.set('status', 'POSTED,SCHEDULED');
  else params.set('clientRejected', '1');

  const responseData = await requestTasks(params, clientIdOverride);
  const tasks = normalizeTasks(responseData);
  const paging = responseData?.paging;
  return {
    tasks,
    total: typeof paging?.total === 'number' ? paging.total : tasks.length,
    hasMore: !!paging?.hasMore,
  };
};

// Tab badge counts: one cheap grouped count on the server, no task rows.
const countsFetcher = async ([, clientIdOverride]: [string, string | null]): Promise<Record<ClientTab, number>> => {
  const params = new URLSearchParams();
  params.set('clientCounts', '1');
  const responseData = await requestTasks(params, clientIdOverride);
  const c = responseData?.counts ?? {};
  return {
    pending: Number(c.pending ?? 0),
    approved: Number(c.approved ?? 0),
    posted: Number(c.posted ?? 0),
    rejected: Number(c.rejected ?? 0),
  };
};

// One paged tab. Lazy: nothing is requested until `enabled` is true.
function useTabPages(
  tab: PagedClientTab,
  enabled: boolean,
  clientIdOverride: string | null,
  swrOptions: Record<string, any>,
) {
  const getKey = (pageIndex: number, previous: TabPage | null) => {
    if (!enabled) return null;
    if (previous && !previous.hasMore) return null; // last page already loaded
    return ['client-tab', clientIdOverride, tab, pageIndex * CLIENT_TAB_PAGE_SIZE] as const;
  };

  const swr = useSWRInfinite<TabPage>(getKey as any, tabPageFetcher as any, {
    ...swrOptions,
    // After an approve / reject / post the same task can move between pages, so
    // reload every loaded page instead of just the first one.
    revalidateAll: true,
    revalidateFirstPage: true,
    // Keep the loaded pages across tab switches.
    persistSize: true,
  });

  const { data: pages, error, isLoading, isValidating, size, setSize, mutate } = swr;

  const tasks = useMemo(
    () => dedupeById((pages ?? []).flatMap((p) => p.tasks)),
    [pages],
  );
  const lastPage = pages && pages.length > 0 ? pages[pages.length - 1] : undefined;

  const loadMore = useCallback(() => {
    setSize((s) => s + 1);
  }, [setSize]);

  const retry = useCallback(() => {
    mutate();
  }, [mutate]);

  const state: ClientTabState = {
    isLoading: enabled && isLoading && !pages,
    isLoadingMore: !!pages && size > 1 && isValidating && typeof pages[size - 1] === 'undefined',
    // Only surface an error when there is nothing to show — a failed background
    // refresh keeps the already-loaded tasks on screen instead of blanking them.
    error: !pages || pages.length === 0 ? ((error as Error | undefined) ?? null) : null,
    hasMore: !!lastPage?.hasMore,
    total: lastPage ? lastPage.total : null,
    loadMore,
    retry,
  };

  return { tasks, state, mutate: mutate as (...args: any[]) => Promise<any> };
}

interface UseClientTasksOptions {
  refreshInterval?: number;
  revalidateOnFocus?: boolean;
  // Pass useEffectiveClientId()'s result here when this hook is used from
  // a page an admin might be previewing as a specific client (currently:
  // ClientDashboard's "Content Review" / approvals tab). Undefined/null
  // for a real client user — the backend falls back to their own session.
  clientIdOverride?: string | null;
  // The tab currently on screen. Approved / Posted / Rejected are only
  // requested once the client has opened them.
  activeTab?: ClientTab;
}

export function useClientTasks(options: UseClientTasksOptions = {}) {
  const {
    refreshInterval = 0, // No auto-refresh by default
    revalidateOnFocus = true,
    clientIdOverride = null,
    activeTab = 'pending',
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

  // Tabs the client has opened stay loaded (and refreshed) for the session.
  const [visited, setVisited] = useState<Set<ClientTab>>(() => new Set<ClientTab>([activeTab]));
  useEffect(() => {
    setVisited((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)));
  }, [activeTab]);
  const isOpen = (tab: ClientTab) => tab === activeTab || visited.has(tab);

  const pending = useSWR<ClientTask[]>(
    ['/api/tasks', clientIdOverride, 'pending'] as [string, string | null, 'pending'],
    pendingFetcher,
    swrOptions,
  );

  // Wait for the pending list to settle (success OR error) before starting the
  // count request, so the screen the user is looking at always gets the server
  // and database to itself first.
  const pendingSettled = pending.data !== undefined || !!pending.error;
  const countsSwr = useSWR<Record<ClientTab, number>>(
    pendingSettled ? (['client-tab-counts', clientIdOverride] as [string, string | null]) : null,
    countsFetcher,
    swrOptions,
  );

  const approved = useTabPages('approved', isOpen('approved'), clientIdOverride, swrOptions);
  const posted = useTabPages('posted', isOpen('posted'), clientIdOverride, swrOptions);
  const rejected = useTabPages('rejected', isOpen('rejected'), clientIdOverride, swrOptions);

  const pendingTasks = pending.data ?? [];

  const tabTasks: Record<ClientTab, ClientTask[]> = {
    pending: pendingTasks,
    approved: approved.tasks,
    posted: posted.tasks,
    rejected: rejected.tasks,
  };

  const tabs: Record<PagedClientTab, ClientTabState> = {
    approved: approved.state,
    posted: posted.state,
    rejected: rejected.state,
  };

  // Every task loaded so far, de-duplicated, for the parts of the screen that
  // look across tabs (deliverable-type filter options, desktop auto-download).
  const tasks = useMemo(
    () => dedupeById([...rejected.tasks, ...posted.tasks, ...approved.tasks, ...pendingTasks]),
    [rejected.tasks, posted.tasks, approved.tasks, pendingTasks],
  );

  // Exact server counts. Until they arrive, fall back to what we can know.
  const serverCounts = countsSwr.data;
  const counts: ClientTabCounts = {
    pending: serverCounts?.pending ?? (pending.data ? pending.data.length : null),
    approved: serverCounts?.approved ?? approved.state.total,
    posted: serverCounts?.posted ?? posted.state.total,
    rejected: serverCounts?.rejected ?? rejected.state.total,
  };

  // Same call signature as SWR's own bound mutate, so existing callers —
  // refreshTasks(), refreshTasks(updaterFn), refreshTasks(fn, { revalidate })
  // — keep working. An updater function is applied to the Pending list and to
  // every loaded page of every other tab (they all match tasks by id, so it's a
  // no-op where the task isn't). Whenever a task changes status (approved,
  // rejected, posted) the tab counts and the other tabs change too, so those
  // are always re-fetched, even when the caller asked to skip revalidation of
  // the Pending list.
  const mutatePending = pending.mutate;
  const mutateCounts = countsSwr.mutate;
  const mutateApproved = approved.mutate;
  const mutatePosted = posted.mutate;
  const mutateRejected = rejected.mutate;
  const mutate = useCallback(
    (async (...args: any[]) => {
      const tabMutators = [mutateApproved, mutatePosted, mutateRejected];
      const [first] = args;

      if (typeof first === 'function') {
        const applyToPages = (pages?: TabPage[]) =>
          pages ? pages.map((p) => ({ ...p, tasks: first(p.tasks) ?? p.tasks })) : pages;

        const results = await Promise.all([
          (mutatePending as any)(...args),
          ...tabMutators.map((m) => m(applyToPages, { revalidate: false })),
        ]);
        await Promise.all([mutateCounts(), ...tabMutators.map((m) => m())]);
        return results[0];
      }

      const results = await Promise.all([
        (mutatePending as any)(...args),
        mutateCounts(),
        ...tabMutators.map((m) => m()),
      ]);
      return results[0];
    }) as unknown as KeyedMutator<ClientTask[]>,
    [mutatePending, mutateCounts, mutateApproved, mutatePosted, mutateRejected],
  );

  // Warm up the TLS connection to the video storage host as soon as we know
  // which one it is, so the first click on "Review" doesn't pay for DNS +
  // TCP + TLS before the first video byte.
  const firstStorageUrl = useMemo(
    () => pending.data?.flatMap((t) => t.files || []).find((f) => f.mimeType?.startsWith('video/') && f.url)?.url,
    [pending.data],
  );
  useEffect(() => {
    if (firstStorageUrl) preconnectToUrlOrigin(firstStorageUrl);
  }, [firstStorageUrl]);

  // Check if any tasks have active optimization jobs
  const hasActiveJobs = tasks.some(
    (t) => t.files?.some((f) => f.optimizationStatus === 'PROCESSING' || f.optimizationStatus === 'PENDING'),
  );

  return {
    tasks,
    tabTasks,
    counts,
    tabs,
    // Only the pending list gates the initial loading state — the other
    // tabs fill in behind it, each with its own loading / error state.
    isLoading: pending.isLoading,
    isValidating:
      pending.isValidating ||
      countsSwr.isValidating ||
      approved.state.isLoading ||
      posted.state.isLoading ||
      rejected.state.isLoading,
    error: pending.error,
    pendingRetry: () => pending.mutate(),
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