import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';
import {
  Calendar,
  CheckCircle,
  FileCheck,
  Filter,
  Loader,
  RotateCcw,
  Search,
  UserCheck,
  XCircle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

// 🛡️ Safe date formatter — returns a fallback string if the date is null/invalid
const safeFormatDate = (
  value: string | null | undefined,
  formatter: (date: Date) => string,
  fallback = '—'
): string => {
  if (!value) return fallback;
  const d = new Date(value);
  if (isNaN(d.getTime())) return fallback;
  try {
    return formatter(d);
  } catch {
    return fallback;
  }
};

type TaskStatus = 'COMPLETED' | 'REJECTED' | 'CLIENT_REVIEW';

interface CompletedTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  dueDate: string;
  clientId?: string;
  taskCategory?: string;
  nextDestination?: string;
  qcNotes?: string;
  feedback?: string;
  priority?: string;
  qcResult?: string | null;
  qcReviewedAt?: string | null;
  qcReviewer?: {
    id: number;
    name: string;
  } | null;
}

interface CompletedTaskApiItem {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  createdAt: string;
  dueDate: string;
  clientId?: string | null;
  taskCategory?: string | null;
  nextDestination?: string | null;
  qcNotes?: string | null;
  feedback?: string | null;
  priority?: string | null;
  qcResult?: string | null;
  qcReviewedAt?: string | null;
  qcReviewer?: {
    id: number;
    name: string;
  } | null;
}

interface CompletedTasksResponse {
  success: boolean;
  tasks?: CompletedTaskApiItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats?: {
    totalReviewed: number;
    approved: number;
    rejected: number;
  };
}

const normalizeCompletedTask = (task: CompletedTaskApiItem): CompletedTask => ({
  id: task.id,
  title: task.title,
  description: task.description || '',
  status: task.status as TaskStatus,
  createdAt: task.createdAt,
  dueDate: task.dueDate,
  clientId: task.clientId,
  taskCategory: task.taskCategory || 'design',
  nextDestination: task.nextDestination || 'scheduler',
  qcNotes: task.qcNotes,
  feedback: task.feedback,
  priority: task.priority || 'medium',
  qcResult: task.qcResult,
  qcReviewedAt: task.qcReviewedAt,
  qcReviewer: task.qcReviewer,
});

const fetchCompletedTasks = async (params: {
  page: number;
  status: 'all' | TaskStatus;
  search: string;
}) => {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    limit: String(PAGE_SIZE),
  });

  if (params.status !== 'all') {
    searchParams.set('status', params.status);
  }

  if (params.search) {
    searchParams.set('search', params.search);
  }

  const res = await fetch(`/api/tasks/qc-completed?${searchParams.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error('Failed fetching completed tasks');
  }

  return (await res.json()) as CompletedTasksResponse;
};

export function QCCompletedPage() {
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedFilter, setCompletedFilter] = useState<'all' | TaskStatus>('all');
  const [completedSearchTerm, setCompletedSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatchingTasks, setTotalMatchingTasks] = useState(0);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalReviewed: 0,
    approved: 0,
    rejected: 0,
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(completedSearchTerm.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [completedSearchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [completedFilter, debouncedSearchTerm]);

  useEffect(() => {
    setSelectedTaskIds(new Set());
  }, [currentPage, completedFilter, debouncedSearchTerm]);

  useEffect(() => {
    let isCancelled = false;

    async function loadCompletedTasks() {
      try {
        setLoading(true);

        const data = await fetchCompletedTasks({
          page: currentPage,
          status: completedFilter,
          search: debouncedSearchTerm,
        });

        if (isCancelled) return;

        const responseTotalPages = data.pagination?.totalPages || 1;
        if (currentPage > responseTotalPages) {
          setCurrentPage(responseTotalPages);
          return;
        }

        const normalizedTasks = Array.isArray(data.tasks)
          ? data.tasks.map(normalizeCompletedTask)
          : [];

        setCompletedTasks(normalizedTasks);
        setTotalPages(responseTotalPages);
        setTotalMatchingTasks(data.pagination?.total || 0);
        setStats({
          totalReviewed: data.stats?.totalReviewed || 0,
          approved: data.stats?.approved || 0,
          rejected: data.stats?.rejected || 0,
        });
      } catch (err) {
        console.error('Completed tasks load error:', err);
        toast.error('Failed to load completed tasks');
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void loadCompletedTasks();

    return () => {
      isCancelled = true;
    };
  }, [currentPage, completedFilter, debouncedSearchTerm]);

  const toggleTaskSelection = (taskId: string) => {
    const newSelection = new Set(selectedTaskIds);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTaskIds(newSelection);
  };

  const allVisibleTasksSelected =
    completedTasks.length > 0 && selectedTaskIds.size === completedTasks.length;

  const toggleSelectAll = () => {
    if (allVisibleTasksSelected) {
      setSelectedTaskIds(new Set());
      return;
    }

    setSelectedTaskIds(new Set(completedTasks.map((task) => task.id)));
  };

  const handleBulkRevert = async () => {
    if (selectedTaskIds.size === 0) {
      toast.error('No tasks selected');
      return;
    }

    try {
      const taskIds = Array.from(selectedTaskIds);

      const response = await fetch('/api/tasks/bulk-revert-to-qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ taskIds }),
      });

      if (!response.ok) throw new Error('Failed to revert tasks');

      toast.success(`✅ ${taskIds.length} task(s) reverted to QC Review`);

      const refreshedData = await fetchCompletedTasks({
        page: currentPage,
        status: completedFilter,
        search: debouncedSearchTerm,
      });

      const responseTotalPages = refreshedData.pagination?.totalPages || 1;
      setSelectedTaskIds(new Set());

      if (currentPage > responseTotalPages) {
        setCurrentPage(responseTotalPages);
        return;
      }

      const normalizedTasks = Array.isArray(refreshedData.tasks)
        ? refreshedData.tasks.map(normalizeCompletedTask)
        : [];

      setCompletedTasks(normalizedTasks);
      setTotalPages(responseTotalPages);
      setTotalMatchingTasks(refreshedData.pagination?.total || 0);
      setStats({
        totalReviewed: refreshedData.stats?.totalReviewed || 0,
        approved: refreshedData.stats?.approved || 0,
        rejected: refreshedData.stats?.rejected || 0,
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to revert tasks');
    }
  };

  const totalCompleted = stats.totalReviewed;
  const approvedCount = stats.approved;
  const rejectedCount = stats.rejected;
  const approvalRate =
    totalCompleted > 0 ? ((approvedCount / totalCompleted) * 100).toFixed(1) : '0';

  const pageStart = totalMatchingTasks === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = totalMatchingTasks === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalMatchingTasks);

  const getStatusBadgeVariant = (status: TaskStatus) => {
    if (status === 'COMPLETED') return 'default';
    if (status === 'CLIENT_REVIEW') return 'secondary';
    return 'destructive';
  };

  const getStatusLabel = (status: TaskStatus) => {
    if (status === 'COMPLETED') return 'Approved';
    if (status === 'CLIENT_REVIEW') return 'Client Review';
    return 'Rejected';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Completed Reviews</h1>
        <p className="text-muted-foreground mt-2">
          Review history and performance tracking
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-2">
              <FileCheck className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Reviewed</p>
                <h3 className="text-2xl font-bold">{totalCompleted}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <h3 className="text-2xl font-bold text-green-600">{approvedCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-2">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <h3 className="text-2xl font-bold text-red-600">{rejectedCount}</h3>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Approval Rate</p>
                <h3 className="text-2xl font-bold">{approvalRate}%</h3>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title or project ID..."
                  value={completedSearchTerm}
                  onChange={(e) => setCompletedSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select
              value={completedFilter}
              onValueChange={(value: 'all' | TaskStatus) => setCompletedFilter(value)}
            >
              <SelectTrigger className="w-full sm:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="COMPLETED">Approved Only</SelectItem>
                <SelectItem value="CLIENT_REVIEW">Client Review</SelectItem>
                <SelectItem value="REJECTED">Rejected Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Review History ({totalMatchingTasks})</CardTitle>
              <CardDescription>Recent review outcomes and feedback</CardDescription>
            </div>
            {completedTasks.length > 0 && (
              <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                <span className="text-sm text-muted-foreground">
                  Showing {pageStart}-{pageEnd} of {totalMatchingTasks}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {allVisibleTasksSelected ? 'Deselect Page' : 'Select Page'}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBulkRevert}
                  disabled={selectedTaskIds.size === 0}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Revert Selected ({selectedTaskIds.size})
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader className="h-8 w-8 mx-auto mb-4 animate-spin" />
              <p>Loading completed reviews...</p>
            </div>
          ) : completedTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-16 w-16 mx-auto mb-4 opacity-40" />
              <h3 className="mb-2">No Completed Reviews</h3>
              <p>
                {debouncedSearchTerm
                  ? 'No reviews match your search right now'
                  : 'Completed reviews will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 hover:bg-accent/50 transition-colors ${
                    selectedTaskIds.has(task.id) ? 'bg-accent border-primary' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedTaskIds.has(task.id)}
                      onCheckedChange={() => toggleTaskSelection(task.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h4 className="font-medium">{task.title}</h4>
                            <Badge variant={getStatusBadgeVariant(task.status)}>
                              {getStatusLabel(task.status)}
                            </Badge>
                            {task.qcReviewer && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                {task.qcReviewer.name}
                              </span>
                            )}
                            {task.qcReviewedAt && (
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-zinc-50 flex items-center gap-1"
                              >
                                <Clock className="h-3 w-3" />
                                {safeFormatDate(
                                  task.qcReviewedAt,
                                  (d) =>
                                    new Intl.DateTimeFormat('en-US', {
                                      timeZone: 'America/New_York',
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true,
                                    }).format(d)
                                )}{' '}
                                EST
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Created:{' '}
                                {safeFormatDate(task.createdAt, (d) => d.toLocaleDateString())}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {(task.feedback || task.qcNotes) && (
                        <div className="mt-3 p-3 bg-accent/50 rounded">
                          <p className="text-sm font-medium mb-1">
                            {task.status === 'COMPLETED'
                              ? 'Feedback Provided:'
                              : task.status === 'CLIENT_REVIEW'
                                ? 'Review Notes:'
                                : 'Rejection Reason:'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {task.feedback || task.qcNotes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {totalPages > 1 && (
                <Pagination className="pt-2">
                  <PaginationContent>
                    <PaginationItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        First
                      </Button>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) {
                            setCurrentPage((prev) => prev - 1);
                          }
                        }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="px-3 text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) {
                            setCurrentPage((prev) => prev + 1);
                          }
                        }}
                        className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage >= totalPages}
                      >
                        Last
                      </Button>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
