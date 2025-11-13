import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar, Clock, FileText, Eye, Search, Filter, CheckCircle, MapPin } from 'lucide-react';
import { useTaskWorkflow, WorkflowTask } from '../workflow/TaskWorkflowEngine';

// Mock current scheduler user
const currentUser = {
  id: 'sch1',
  name: 'Emma White',
  role: 'scheduler'
};

export function SchedulerApprovedQueuePage() {
  const [schedulingTasks, setSchedulingTasks] = useState<WorkflowTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const { tasks: workflowTasks, completeSchedulingTask } = useTaskWorkflow();

  useEffect(() => {
    // Filter workflow tasks for scheduling
    const userSchedulingTasks = workflowTasks.filter(task => 
      task.assignedTo === currentUser.id && task.type === 'scheduling'
    );
    
    setSchedulingTasks(userSchedulingTasks);
    
    // Auto-select first pending task
    if (!selectedTask && userSchedulingTasks.length > 0) {
      const firstPending = userSchedulingTasks.find(task => task.status === 'pending');
      if (firstPending) setSelectedTask(firstPending);
    }
  }, [workflowTasks, selectedTask]);

  const handleScheduleTask = async (task: WorkflowTask) => {
    try {
      // Update task locally
      setSchedulingTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, status: 'completed' } : t
      ));

      // Complete the workflow
      await completeSchedulingTask(task);

      console.log('✅ Task scheduled and workflow completed:', task.id);
      
      // Move to next task
      const nextTask = schedulingTasks.find(t => t.status === 'pending' && t.id !== task.id);
      setSelectedTask(nextTask || null);
      
    } catch (error) {
      console.error('Error scheduling task:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  // Filter tasks based on search and priority
  const filteredTasks = schedulingTasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const pendingTasks = filteredTasks.filter(task => task.status === 'pending');
  const completedTasks = filteredTasks.filter(task => task.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>Approved Queue</h1>
        <p className="text-muted-foreground mt-2">
          QC-approved content ready for scheduling and production planning
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <h3>{pendingTasks.length}</h3>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Today</p>
                <h3>{completedTasks.filter(t => 
                  new Date(t.createdAt).toDateString() === new Date().toDateString()
                ).length}</h3>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent Items</p>
                <h3>{pendingTasks.filter(t => t.priority === 'urgent').length}</h3>
              </div>
              <Calendar className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by task ID or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Pending Tasks
              <Badge variant="secondary">{pendingTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0 max-h-[600px] overflow-y-auto">
              {pendingTasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p>No pending tasks</p>
                  <p className="text-xs">Tasks will appear here after QC approval</p>
                </div>
              ) : (
                pendingTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`p-4 border-b hover:bg-muted/50 cursor-pointer transition-colors ${
                      selectedTask?.id === task.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-sm">
                          {task.title.replace('Schedule: ', '')}
                        </h4>
                        <Badge
                          variant={getPriorityColor(task.priority)}
                          className="text-xs"
                        >
                          {task.priority}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          <span>From QC Approval</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          <span>Due {task.dueDate}</span>
                        </div>
                        {task.files && (
                          <div className="flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            <span>{task.files.length} files</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {task.id}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScheduleTask(task);
                          }}
                        >
                          Schedule
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Details */}
        <Card>
          <CardHeader>
            <CardTitle>Task Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedTask ? (
              <div className="space-y-4">
                {/* Task Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Task ID</p>
                    <p className="font-medium">{selectedTask.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Priority</p>
                    <Badge variant={getPriorityColor(selectedTask.priority)}>
                      {selectedTask.priority}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Project ID</p>
                    <p className="font-medium">{selectedTask.projectId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">{selectedTask.dueDate}</p>
                  </div>
                </div>

                {/* QC Feedback */}
                {selectedTask.feedback && (
                  <div>
                    <h4 className="font-medium mb-2">QC Feedback</h4>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">{selectedTask.feedback}</p>
                    </div>
                  </div>
                )}

                {/* Files */}
                {selectedTask.files && selectedTask.files.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Approved Files ({selectedTask.files.length})</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {selectedTask.files.map((file) => (
                        <div key={file.id} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="h-4 w-4" />
                            <span className="text-sm font-medium truncate">{file.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            {formatFileSize(file.size)}
                          </p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full"
                            onClick={() => window.open(file.url, '_blank')}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View File
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action */}
                {selectedTask.status === 'pending' && (
                  <div className="flex justify-center pt-4">
                    <Button 
                      size="lg" 
                      onClick={() => handleScheduleTask(selectedTask)}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule This Content
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p>Select a task to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
