import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { CheckCircle, XCircle, FileCheck, Calendar, FileText, Video, Palette, User, ArrowRight, Search, Filter, UserCheck, Loader, RotateCcw, Clock } from 'lucide-react';
import { toast } from 'sonner';

type TaskStatus = 'COMPLETED' | 'REJECTED' | 'CLIENT_REVIEW';
type TaskCategory = 'design' | 'video' | 'copywriting' | 'review';
type TaskDestination = 'editor' | 'client' | 'scheduler';

interface CompletedTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  dueDate: string;
  clientId?: string;
  taskCategory?: TaskCategory;
  nextDestination?: TaskDestination;
  qcNotes?: string;
  feedback?: string;
  priority?: string;
  // 🔥 QC reviewer tracking
  qcResult?: string | null;
  qcReviewedAt?: string | null;
  qcReviewer?: {
    id: number;
    name: string;
  } | null;
}

export function QCCompletedPage() {
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedFilter, setCompletedFilter] = useState<'all' | 'COMPLETED' | 'REJECTED' | 'CLIENT_REVIEW'>('all');
  const [completedSearchTerm, setCompletedSearchTerm] = useState('');

  // Multi-select state
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCompletedTasks();
  }, []);

  const loadCompletedTasks = async () => {
    try {
      setLoading(true);

      // 🔥 Fetch COMPLETED and REJECTED tasks
      const res = await fetch("/api/tasks?status=COMPLETED,REJECTED,CLIENT_REVIEW", {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed fetching completed tasks");

      let data = await res.json();

      if (data.tasks) data = data.tasks;
      if (!Array.isArray(data)) {
        console.error("API returned non-array:", data);
        return;
      }

      const normalized = data.map((task: any) => ({
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
        // 🔥 QC reviewer tracking
        qcResult: task.qcResult,
        qcReviewedAt: task.qcReviewedAt,
        qcReviewer: task.qcReviewer,
      }));

      const sorted = normalized.sort(
        (a, b) => {
          const timeA = a.qcReviewedAt ? new Date(a.qcReviewedAt).getTime() : new Date(a.createdAt).getTime();
          const timeB = b.qcReviewedAt ? new Date(b.qcReviewedAt).getTime() : new Date(b.createdAt).getTime();
          return timeB - timeA;
        }
      );

      setCompletedTasks(sorted);
    } catch (err) {
      console.error("Completed tasks load error:", err);
      toast.error("Failed to load completed tasks");
    } finally {
      setLoading(false);
    }
  };

  // Toggle individual task selection
  const toggleTaskSelection = (taskId: string) => {
    const newSelection = new Set(selectedTaskIds);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTaskIds(newSelection);
  };

  // Select all/none
  const toggleSelectAll = () => {
    if (selectedTaskIds.size === filteredCompletedTasks.length && filteredCompletedTasks.length > 0) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredCompletedTasks.map(t => t.id)));
    }
  };

  // Bulk revert selected tasks back to QC review
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

      // Reload completed tasks
      await loadCompletedTasks();

      // Clear selection
      setSelectedTaskIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Failed to revert tasks');
    }
  };

  const totalCompleted = completedTasks.length;
  const approvedCount = completedTasks.filter(t => t.status === 'COMPLETED').length;
  const rejectedCount = completedTasks.filter(t => t.status === 'REJECTED').length;
  const approvalRate = totalCompleted > 0 ? ((approvedCount / totalCompleted) * 100).toFixed(1) : '0';

  // Filter completed tasks
  const filteredCompletedTasks = completedTasks.filter(task => {
    const matchesFilter = completedFilter === 'all' || task.status === completedFilter;
    const matchesSearch = task.title.toLowerCase().includes(completedSearchTerm.toLowerCase()) ||
      task.clientId?.toLowerCase().includes(completedSearchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'CLIENT_REVIEW':
        return <UserCheck className="h-4 w-4 text-purple-500" />;
      default:
        return null;
    }
  };

  const getTaskCategoryIcon = (category?: string) => {
    switch (category) {
      case 'video':
        return <Video className="h-3 w-3" />;
      case 'design':
        return <Palette className="h-3 w-3" />;
      case 'copywriting':
        return <FileText className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getDestinationIcon = (destination?: TaskDestination) => {
    switch (destination) {
      case 'client':
        return <UserCheck className="h-3 w-3" />;
      case 'scheduler':
        return <Calendar className="h-3 w-3" />;
      case 'editor':
        return <User className="h-3 w-3" />;
      default:
        return <ArrowRight className="h-3 w-3" />;
    }
  };

  const getDestinationColor = (destination?: TaskDestination) => {
    switch (destination) {
      case 'client':
        return 'text-purple-600 bg-purple-100';
      case 'scheduler':
        return 'text-green-600 bg-green-100';
      case 'editor':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

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
      {/* Page Header */}
      <div>
        <h1>Completed Reviews</h1>
        <p className="text-muted-foreground mt-2">
          Review history and performance tracking
        </p>
      </div>

      {/* Stats Summary */}
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

      {/* Filters */}
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
            <Select value={completedFilter} onValueChange={(value: any) => setCompletedFilter(value)}>
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

      {/* Completed Tasks List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review History ({filteredCompletedTasks.length})</CardTitle>
              <CardDescription>Recent review outcomes and feedback</CardDescription>
            </div>
            {filteredCompletedTasks.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                >
                  {selectedTaskIds.size === filteredCompletedTasks.length && filteredCompletedTasks.length > 0 ? 'Deselect All' : 'Select All'}
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
          ) : filteredCompletedTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-16 w-16 mx-auto mb-4 opacity-40" />
              <h3 className="mb-2">No Completed Reviews</h3>
              <p>Completed reviews will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCompletedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 hover:bg-accent/50 transition-colors ${selectedTaskIds.has(task.id) ? 'bg-accent border-primary' : ''
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
                            {/* {getStatusIcon(task.status)} */}
                            <h4 className="font-medium">{task.title}</h4>
                            <Badge variant={getStatusBadgeVariant(task.status)}>
                              {getStatusLabel(task.status)}
                            </Badge>
                            {/* 🔥 Show QC Reviewer */}
                            {task.qcReviewer && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <UserCheck className="h-3 w-3" />
                                {task.qcReviewer.name}
                              </span>
                            )}

                            {/* 🔥 Exact EST Time of Review */}
                            {task.qcReviewedAt && (
                              <Badge variant="outline" className="text-[10px] bg-zinc-50 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Intl.DateTimeFormat('en-US', {
                                  timeZone: 'America/New_York',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                }).format(new Date(task.qcReviewedAt))} EST
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Created: {new Date(task.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        {/* {task.nextDestination && (
                          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs flex-shrink-0 ${getDestinationColor(task.nextDestination)}`}>
                            {getDestinationIcon(task.nextDestination)}
                            <span className="capitalize">→ {task.nextDestination}</span>
                          </div>
                        )} */}
                      </div>
                      {(task.feedback || task.qcNotes) && (
                        <div className="mt-3 p-3 bg-accent/50 rounded">
                          <p className="text-sm font-medium mb-1">
                            {task.status === 'COMPLETED' ? 'Feedback Provided:' :
                              task.status === 'CLIENT_REVIEW' ? 'Review Notes:' : 'Rejection Reason:'}
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}