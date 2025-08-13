import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Plus, Calendar, MessageSquare, Paperclip, Upload, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { FileUploadDialog } from '../workflow/FileUploadDialog';
import { useTaskWorkflow, WorkflowTask } from '../workflow/TaskWorkflowEngine';
import { useGlobalTasks, GlobalTask } from '../workflow/GlobalTaskManager';
import { useAuth } from '../auth/AuthContext';

// Convert GlobalTask to WorkflowTask for compatibility with existing components
function convertToWorkflowTask(task: GlobalTask): WorkflowTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type === 'design' || task.type === 'video' || task.type === 'copywriting' ? 'edit' : 
          task.type === 'review' || task.type === 'audit' ? 'qc_review' : 'scheduling',
    status: task.status,
    assignedTo: task.assignedTo,
    assignedToName: task.assignedToName,
    assignedToRole: task.assignedToRole,
    createdAt: task.createdAt,
    dueDate: task.dueDate,
    workflowStep: task.workflowStep,
    projectId: task.projectId,
    parentTaskId: task.parentTaskId,
    files: task.files,
    feedback: task.feedback,
    rejectionReason: task.rejectionReason,
    originalTaskId: task.originalTaskId
  };
}

// Mock initial tasks for the editor
const initialTasks: WorkflowTask[] = [
  {
    id: 'EDIT-001',
    title: 'Brand Guidelines Update',
    description: 'Update brand guidelines for Q4 campaign with new color palette and typography',
    type: 'edit',
    status: 'in_progress',
    assignedTo: 'ed1',
    assignedToName: 'Sarah Wilson',
    assignedToRole: 'editor',
    createdAt: '2024-08-10T08:00:00Z',
    dueDate: '2024-08-15',
    workflowStep: 'editing',
    projectId: 'proj-001'
  },
  {
    id: 'EDIT-002',
    title: 'Social Media Assets',
    description: 'Create Instagram and Facebook post designs for holiday campaign',
    type: 'edit',
    status: 'pending',
    assignedTo: 'ed1',
    assignedToName: 'Sarah Wilson',
    assignedToRole: 'editor',
    createdAt: '2024-08-10T09:00:00Z',
    dueDate: '2024-08-18',
    workflowStep: 'editing',
    projectId: 'proj-002'
  },
  {
    id: 'REV-001',
    title: 'Revision Required: Product Packaging',
    description: 'Revisions needed for: Product Packaging\n\nQC Feedback: Colors are too saturated and don\'t match brand guidelines. Please adjust the color scheme and ensure proper contrast ratios.',
    type: 'edit',
    status: 'pending',
    assignedTo: 'ed1',
    assignedToName: 'Sarah Wilson',
    assignedToRole: 'editor',
    createdAt: '2024-08-10T10:00:00Z',
    dueDate: '2024-08-11',
    workflowStep: 'editing',
    rejectionReason: 'Colors are too saturated and don\'t match brand guidelines. Please adjust the color scheme and ensure proper contrast ratios.',
    originalTaskId: 'EDIT-003'
  }
];

function TaskCard({ task, onUploadComplete, onStartTask }: { task: WorkflowTask, onUploadComplete: (files: any[]) => void, onStartTask?: () => void }) {
  const isRevision = task.id.startsWith('REV-');
  const isOverdue = new Date(task.dueDate) < new Date();

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'pending':
        return <Calendar className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  return (
    <Card className={`${isRevision ? 'border-orange-200 bg-orange-50/50' : ''} ${isOverdue ? 'border-red-200' : ''} hover:shadow-md transition-shadow`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getStatusIcon()}
            <h4 className="font-medium text-sm truncate">{task.title}</h4>
          </div>
          <Badge 
            variant={task.status === 'completed' ? 'default' : 'secondary'}
            className="text-xs ml-2 flex-shrink-0"
          >
            {task.status.replace('_', ' ')}
          </Badge>
        </div>

        {isRevision && (
          <div className="mb-3 p-2 bg-orange-100 rounded-md">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="h-3 w-3 text-orange-600" />
              <span className="text-xs font-medium text-orange-800">Revision Required</span>
            </div>
            <p className="text-xs text-orange-700">
              {task.rejectionReason}
            </p>
          </div>
        )}
        
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
          {task.description}
        </p>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src="" />
              <AvatarFallback className="text-xs">SW</AvatarFallback>
            </Avatar>
            <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              Due {new Date(task.dueDate).toLocaleDateString()}
              {isOverdue && ' (Overdue)'}
            </span>
          </div>
          
          {task.files && task.files.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Paperclip className="h-3 w-3" />
              <span>{task.files.length}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={() => {
              // In real app, this would open task details
              console.log('View task details:', task.id);
            }}
          >
            View Details
          </Button>
          
          {task.status === 'pending' && onStartTask && (
            <Button 
              size="sm" 
              variant="outline"
              className="flex-1"
              onClick={onStartTask}
            >
              Start Task
            </Button>
          )}
          
          {task.status === 'in_progress' && (
            <FileUploadDialog
              task={task}
              onUploadComplete={onUploadComplete}
              trigger={
                <Button size="sm" className="flex-1">
                  <Upload className="h-3 w-3 mr-1" />
                  Complete
                </Button>
              }
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function EditorDashboard() {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const { tasks: workflowTasks, updateTask } = useTaskWorkflow();
  const { tasks: globalTasks, updateTask: updateGlobalTask } = useGlobalTasks();
  const { user } = useAuth();

  const currentUser = {
    id: user?.id || 'ed2', // Default to editor user ID
    name: user?.name || 'Editor User',
    role: user?.role || 'editor'
  };

  useEffect(() => {
    // Get tasks assigned to current editor from both systems
    const userGlobalTasks = globalTasks.filter(task => 
      task.assignedTo === currentUser.id && 
      (task.assignedToRole === 'editor' || task.type === 'design' || task.type === 'video' || task.type === 'copywriting')
    ).map(convertToWorkflowTask);

    const userWorkflowTasks = workflowTasks.filter(task => 
      task.assignedTo === currentUser.id && task.type === 'edit'
    );
    
    // Combine both types of tasks, prioritizing global tasks
    const combinedTasks = [
      ...userGlobalTasks,
      ...userWorkflowTasks.filter(wt => 
        !userGlobalTasks.some(gt => gt.id === wt.id)
      ),
      // Keep initial tasks for demo purposes, but only if no global tasks exist
      ...(globalTasks.length === 0 ? initialTasks : [])
    ];
    
    setTasks(combinedTasks);
  }, [workflowTasks, globalTasks, currentUser.id]);

  const handleUploadComplete = (taskId: string, files: any[]) => {
    // Update task status in local state
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, status: 'completed', files }
        : task
    ));

    // Update in both workflow engine and global task manager
    updateTask(taskId, { status: 'completed', files });
    updateGlobalTask(taskId, { status: 'completed', files });
    
    console.log(`✅ Task ${taskId} completed and files uploaded. QC review task will be created automatically.`);
  };

  // Organize tasks by status
  const tasksByStatus = {
    pending: tasks.filter(task => task.status === 'pending'),
    inProgress: tasks.filter(task => task.status === 'in_progress'),
    readyForQC: tasks.filter(task => task.status === 'completed'),
    revisions: tasks.filter(task => task.id.startsWith('REV-') && task.status === 'pending')
  };

  const columns = [
    { id: 'pending', title: 'Pending', tasks: tasksByStatus.pending, color: 'text-gray-600' },
    { id: 'inProgress', title: 'In Progress', tasks: tasksByStatus.inProgress, color: 'text-blue-600' },
    { id: 'readyForQC', title: 'Ready for QC', tasks: tasksByStatus.readyForQC, color: 'text-green-600' },
    { id: 'revisions', title: 'Revisions Needed', tasks: tasksByStatus.revisions, color: 'text-orange-600' }
  ];

  const startTask = (taskId: string) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status: 'in_progress' } : task
    ));
    updateTask(taskId, { status: 'in_progress' });
    updateGlobalTask(taskId, { status: 'in_progress' });
  };

  const totalTasks = tasks.length;
  const completedToday = tasksByStatus.readyForQC.filter(task => 
    new Date(task.createdAt).toDateString() === new Date().toDateString()
  ).length;
  const overdueTasks = tasks.filter(task => 
    new Date(task.dueDate) < new Date() && task.status !== 'completed'
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Editor Portal</h1>
          <p className="text-muted-foreground mt-2">
            Manage your assigned tasks and complete work for QC review
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <h3>{totalTasks}</h3>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <h3>{completedToday}</h3>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <h3 className="text-red-500">{overdueTasks}</h3>
              </div>
              <Clock className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Automated Workflow</h4>
              <p className="text-sm text-muted-foreground">
                When you complete a task and upload files, a QC review task is automatically created. 
                If approved, it goes to scheduling. If rejected, you'll get a revision task.
              </p>
              <div className="mt-2 text-xs text-muted-foreground">
                Logged in as: {currentUser.name} (ID: {currentUser.id}) | Total tasks from admin/manager: {globalTasks.filter(t => t.assignedTo === currentUser.id).length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => (
          <div key={column.id} className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className={`font-medium ${column.color}`}>{column.title}</h3>
              <Badge variant="secondary" className="text-xs">
                {column.tasks.length}
              </Badge>
            </div>
            
            <div className="space-y-4 min-h-[400px]">
              {column.tasks.map((task) => (
                <TaskCard 
                  key={task.id}
                  task={task} 
                  onUploadComplete={(files) => handleUploadComplete(task.id, files)}
                  onStartTask={() => startTask(task.id)}
                />
              ))}
              {column.tasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No tasks</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}