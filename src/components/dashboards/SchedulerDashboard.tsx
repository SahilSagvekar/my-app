import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Calendar, ChevronLeft, ChevronRight, Clock, Users, MapPin, CheckCircle, FileText, Eye } from 'lucide-react';
import { useTaskWorkflow, WorkflowTask } from '../workflow/TaskWorkflowEngine';

// Mock current scheduler user
const currentUser = {
  id: 'sch1',
  name: 'Emma White',
  role: 'scheduler'
};

const currentDate = new Date(2024, 7, 10); // August 2024

// Mock scheduled events (in real app would come from API)
const calendarEvents = {
  '2024-08-12': [
    { id: 1, title: 'Video Shoot - Product Demo', time: '09:00', type: 'production', color: 'bg-blue-500' },
    { id: 2, title: 'Client Meeting - Brand Review', time: '14:00', type: 'meeting', color: 'bg-purple-500' }
  ],
  '2024-08-13': [
    { id: 3, title: 'Photo Shoot - Lifestyle', time: '10:00', type: 'production', color: 'bg-blue-500' }
  ],
  '2024-08-14': [
    { id: 4, title: 'Content Delivery', time: '11:00', type: 'delivery', color: 'bg-green-500' },
    { id: 5, title: 'Team Standup', time: '09:00', type: 'meeting', color: 'bg-purple-500' }
  ],
  '2024-08-15': [
    { id: 6, title: 'Campaign Launch', time: '16:00', type: 'launch', color: 'bg-orange-500' }
  ],
  '2024-08-16': [
    { id: 7, title: 'Video Shoot - Interview', time: '13:00', type: 'production', color: 'bg-blue-500' }
  ]
};

// Mock initial scheduling tasks
const initialSchedulingTasks: WorkflowTask[] = [];

function CalendarGrid() {
  const [currentMonth, setCurrentMonth] = useState(currentDate);
  
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };
  
  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => null);
  
  const formatEventDate = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="p-2 h-24"></div>
        ))}
        
        {days.map(day => {
          const dateKey = formatEventDate(day);
          const dayEvents = calendarEvents[dateKey] || [];
          const isToday = day === 10; // Current day for demo
          
          return (
            <div
              key={day}
              className={`p-2 h-24 border border-border rounded-lg hover:bg-muted/50 ${
                isToday ? 'bg-primary/10 border-primary' : ''
              }`}
            >
              <div className={`text-sm mb-1 ${isToday ? 'font-medium text-primary' : ''}`}>
                {day}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    className={`text-xs px-1 py-0.5 rounded text-white truncate ${event.color}`}
                  >
                    {event.time} {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-muted-foreground">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SchedulerDashboard() {
  const [schedulingTasks, setSchedulingTasks] = useState<WorkflowTask[]>(initialSchedulingTasks);
  const [selectedTask, setSelectedTask] = useState<WorkflowTask | null>(null);
  const { tasks: workflowTasks, completeSchedulingTask } = useTaskWorkflow();

  useEffect(() => {
    // Filter workflow tasks for scheduling
    const userSchedulingTasks = workflowTasks.filter(task => 
      task.assignedTo === currentUser.id && task.type === 'scheduling'
    );
    
    // Combine with initial tasks
    const allSchedulingTasks = [...initialSchedulingTasks, ...userSchedulingTasks.filter(wt => 
      !initialSchedulingTasks.some(it => it.id === wt.id)
    )];
    
    setSchedulingTasks(allSchedulingTasks);
    
    // Auto-select first pending task
    if (!selectedTask && allSchedulingTasks.length > 0) {
      const firstPending = allSchedulingTasks.find(task => task.status === 'pending');
      if (firstPending) setSelectedTask(firstPending);
    }
  }, [workflowTasks, selectedTask]);

  const handleScheduleTask = async (task: WorkflowTask) => {
    try {
      // In real app, this would show a scheduling dialog and collect schedule details
      // For demo, we'll simulate scheduling
      
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

  // Stats
  const pendingTasks = schedulingTasks.filter(task => task.status === 'pending').length;
  const scheduledToday = schedulingTasks.filter(task => 
    task.status === 'completed' &&
    new Date(task.createdAt).toDateString() === new Date().toDateString()
  ).length;
  const urgentTasks = schedulingTasks.filter(task => task.priority === 'urgent' && task.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Scheduler Portal</h1>
          <p className="text-muted-foreground mt-2">
            Schedule QC-approved content and manage production timeline
          </p>
        </div>
        <Button>
          <Calendar className="h-4 w-4 mr-2" />
          New Schedule
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Tasks</p>
                <h3>{pendingTasks}</h3>
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
                <h3>{scheduledToday}</h3>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgent Tasks</p>
                <h3>{urgentTasks}</h3>
              </div>
              <Calendar className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Events</p>
                <h3>7</h3>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Automated Content Flow</h4>
              <p className="text-sm text-muted-foreground">
                You receive QC-approved content automatically. Once you schedule it, the workflow is complete.
                Content is ready for production and client delivery.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Production Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarGrid />
          </CardContent>
        </Card>

        {/* Approved Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Approved Queue
              <Badge variant="secondary">{pendingTasks}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0 max-h-[600px] overflow-y-auto">
              {schedulingTasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p>No approved tasks to schedule</p>
                  <p className="text-xs">Tasks will appear here after QC approval</p>
                </div>
              ) : (
                schedulingTasks.map((task) => (
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
                        <div className="flex gap-1">
                          {task.status === 'completed' ? (
                            <Badge variant="default" className="text-xs">
                              Scheduled
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleScheduleTask(task);
                              }}
                            >
                              Schedule
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Task Details */}
      {selectedTask && (
        <Card>
          <CardHeader>
            <CardTitle>Task Details: {selectedTask.title.replace('Schedule: ', '')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Task Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Project ID</p>
                  <p className="font-medium">{selectedTask.projectId || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Priority</p>
                  <Badge variant={getPriorityColor(selectedTask.priority)}>
                    {selectedTask.priority}
                  </Badge>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                          View
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}