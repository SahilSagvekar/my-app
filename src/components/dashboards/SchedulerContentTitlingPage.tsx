// src/components/dashboards/SchedulerContentTitlingPage.tsx

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import {
  Sparkles,
  Video,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Clock,
  Calendar,
  Search,
  Filter,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';

interface GeneratedTitle {
  title: string;
  style: string;
  reasoning: string;
  hashtags?: string[];
}

interface TaskWithTitles {
  id: string;
  title: string;
  description: string;
  status: string;
  titlingStatus: string;
  titlingError?: string;
  transcript?: string;
  transcriptSummary?: string;
  suggestedTitles?: GeneratedTitle[];
  platform?: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    name: string;
    companyName?: string;
  };
  files?: {
    id: string;
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }[];
  titlingJob?: {
    id: string;
    status: string;
    videoDuration?: number;
    completedAt?: string;
  };
}

export function SchedulerContentTitlingPage() {
  const [tasks, setTasks] = useState<TaskWithTitles[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskWithTitles | null>(null);
  const [showTitleDialog, setShowTitleDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTitlingStatus, setFilterTitlingStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTitle, setCopiedTitle] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  // Fetch tasks with titling data
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/schedular/tasks?includeTitling=true');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const data = await response.json();
      const taskList = Array.isArray(data) ? data : (data.tasks || []);

      // Filter to only show tasks that have been through QC (COMPLETED or CLIENT_REVIEW status)
      // and have video files
      const tasksWithVideos = taskList.filter((task: TaskWithTitles) =>
        (task.status === 'COMPLETED' || task.status === 'CLIENT_REVIEW' || task.status === 'SCHEDULED') &&
        task.files?.some(f => f.mimeType?.startsWith('video/'))
      );

      setTasks(tasksWithVideos);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateTitles = async (taskId: string) => {
    try {
      setRegenerating(taskId);
      const response = await fetch(`/api/tasks/${taskId}/generate-titles?force=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'general' }),
      });

      if (!response.ok) throw new Error('Failed to regenerate titles');

      toast.success('Title generation started!', {
        description: 'New titles will be ready in a few minutes'
      });

      // Refresh after a delay
      setTimeout(() => {
        fetchTasks();
        setRegenerating(null);
      }, 5000);

    } catch (error) {
      console.error('Error regenerating titles:', error);
      toast.error('Failed to regenerate titles');
      setRegenerating(null);
    }
  };

  const handleCopyTitle = (title: string) => {
    navigator.clipboard.writeText(title);
    setCopiedTitle(title);
    setTimeout(() => setCopiedTitle(null), 2000);
    toast.success('Copied to clipboard!');
  };

  const handleViewTask = (task: TaskWithTitles) => {
    setSelectedTask(task);
    setShowTitleDialog(true);
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterTitlingStatus !== 'all' && task.titlingStatus !== filterTitlingStatus) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = task.title?.toLowerCase().includes(query);
      const matchesClient = task.client?.name?.toLowerCase().includes(query);
      const matchesDescription = task.description?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesClient && !matchesDescription) return false;
    }
    return true;
  });

  const getTitlingStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge className="bg-green-500 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Titles Ready</Badge>;
      case 'PROCESSING':
        return <Badge className="bg-blue-500 text-white"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating...</Badge>;
      case 'FAILED':
        return <Badge className="bg-red-500 text-white"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500 text-white"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />No Titles</Badge>;
    }
  };

  const getStyleBadgeColor = (style: string) => {
    const colors: Record<string, string> = {
      'story': 'bg-purple-100 text-purple-700',
      'how-to': 'bg-blue-100 text-blue-700',
      'listicle': 'bg-green-100 text-green-700',
      'curiosity': 'bg-orange-100 text-orange-700',
      'contrarian': 'bg-red-100 text-red-700',
      'question': 'bg-yellow-100 text-yellow-700',
    };
    return colors[style?.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Stats
  const stats = {
    total: tasks.length,
    withTitles: tasks.filter(t => t.titlingStatus === 'COMPLETED').length,
    processing: tasks.filter(t => t.titlingStatus === 'PROCESSING').length,
    pending: tasks.filter(t => !t.titlingStatus || t.titlingStatus === 'NONE').length,
    failed: tasks.filter(t => t.titlingStatus === 'FAILED').length,
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-12" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold mb-1">AI Content Titling</h1>
        <p className="text-sm text-muted-foreground">
          View and manage AI-generated titles for approved videos
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Videos</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-lg">
                <Video className="h-5 w-5 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Titles Ready</p>
                <p className="text-2xl font-semibold text-green-600">{stats.withTitles}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Generating</p>
                <p className="text-2xl font-semibold text-blue-600">{stats.processing}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Loader2 className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-semibold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-semibold text-red-600">{stats.failed}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <Select value={filterTitlingStatus} onValueChange={setFilterTitlingStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Titling Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Titling Status</SelectItem>
                <SelectItem value="COMPLETED">Titles Ready</SelectItem>
                <SelectItem value="PROCESSING">Generating</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="NONE">No Titles</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Task Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CLIENT_REVIEW">Client Review</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks or clients..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Button variant="outline" size="sm" onClick={fetchTasks}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <div className="space-y-4">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No tasks found matching your filters</p>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Video Thumbnail Placeholder */}
                  <div className="w-32 h-20 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                    <Play className="h-8 w-8 text-gray-400" />
                  </div>

                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="min-w-0">
                        <h3 className="font-medium truncate">{task.title || task.description}</h3>
                        <p className="text-sm text-muted-foreground">
                          {task.client?.name || 'Unknown Client'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getTitlingStatusBadge(task.titlingStatus)}
                        <Badge variant="outline">{task.status}</Badge>
                      </div>
                    </div>

                    {/* Titles Preview */}
                    {task.titlingStatus === 'COMPLETED' && task.suggestedTitles && task.suggestedTitles.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium">{task.suggestedTitles.length} AI Titles Generated</span>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm font-medium text-gray-900 mb-1">
                            Top suggestion:
                          </p>
                          <p className="text-sm text-gray-700">
                            "{task.suggestedTitles[0]?.title}"
                          </p>
                          <Badge className={`mt-2 ${getStyleBadgeColor(task.suggestedTitles[0]?.style)}`}>
                            {task.suggestedTitles[0]?.style}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {task.titlingStatus === 'FAILED' && task.titlingError && (
                      <div className="mb-3 p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-700">
                          <AlertCircle className="h-4 w-4 inline mr-1" />
                          {task.titlingError}
                        </p>
                      </div>
                    )}

                    {/* Meta Info */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(task.createdAt).toLocaleDateString()}
                      </span>
                      {task.titlingJob?.videoDuration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(task.titlingJob.videoDuration)}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {task.titlingStatus === 'COMPLETED' && (
                        <Button
                          size="sm"
                          onClick={() => handleViewTask(task)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View All Titles
                        </Button>
                      )}

                      {(task.titlingStatus === 'COMPLETED' || task.titlingStatus === 'FAILED') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRegenerateTitles(task.id)}
                          disabled={regenerating === task.id}
                        >
                          {regenerating === task.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Regenerate
                        </Button>
                      )}

                      {task.titlingStatus === 'PROCESSING' && (
                        <Button size="sm" variant="outline" disabled>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </Button>
                      )}

                      {(!task.titlingStatus || task.titlingStatus === 'NONE') && (
                        <Button
                          size="sm"
                          onClick={() => handleRegenerateTitles(task.id)}
                          disabled={regenerating === task.id}
                        >
                          {regenerating === task.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-2" />
                          )}
                          Generate Titles
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Quick View Arrow */}
                  {task.titlingStatus === 'COMPLETED' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewTask(task)}
                      className="flex-shrink-0"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Title Details Dialog */}
      <Dialog open={showTitleDialog} onOpenChange={setShowTitleDialog}>
        <DialogContent className="!max-w-4xl !max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              AI Generated Titles
            </DialogTitle>
            <DialogDescription>
              {selectedTask?.title || selectedTask?.description} • {selectedTask?.client?.name}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="titles" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="titles">
                <Sparkles className="h-4 w-4 mr-2" />
                Titles ({selectedTask?.suggestedTitles?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="transcript">
                <FileText className="h-4 w-4 mr-2" />
                Transcript
              </TabsTrigger>
            </TabsList>

            <TabsContent value="titles" className="flex-1 overflow-auto mt-4">
              <div className="space-y-3">
                {selectedTask?.suggestedTitles?.map((suggestion, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              #{index + 1}
                            </Badge>
                            <Badge className={getStyleBadgeColor(suggestion.style)}>
                              {suggestion.style}
                            </Badge>
                          </div>
                          <h4 className="font-medium text-lg mb-2">
                            {suggestion.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            💡 {suggestion.reasoning}
                          </p>
                          {suggestion.hashtags && suggestion.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {suggestion.hashtags.map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyTitle(suggestion.title)}
                          className="flex-shrink-0"
                        >
                          {copiedTitle === suggestion.title ? (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {selectedTask?.suggestedTitles && selectedTask.suggestedTitles.length > 0 && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (selectedTask) {
                          handleRegenerateTitles(selectedTask.id);
                          setShowTitleDialog(false);
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Generate New Titles
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="transcript" className="flex-1 overflow-auto mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Video Transcript
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedTask?.transcriptSummary && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 mb-1">Summary:</p>
                      <p className="text-sm text-blue-800">{selectedTask.transcriptSummary}</p>
                    </div>
                  )}
                  <ScrollArea className="h-72">
                    <p className="text-sm whitespace-pre-wrap text-gray-700">
                      {selectedTask?.transcript || 'No transcript available'}
                    </p>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
