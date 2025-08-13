import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Clock, User } from 'lucide-react';
import { Button } from '../ui/button';

interface Task {
  id: string;
  title: string;
  type: string;
  assignedTo: {
    name: string;
    avatar: string;
    role: string;
  };
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
}

// Mock recent tasks data
const recentTasks: Task[] = [
  {
    id: 'TASK-001',
    title: 'Create holiday campaign assets',
    type: 'design',
    assignedTo: {
      name: 'Sarah Wilson',
      avatar: 'SW',
      role: 'Senior Designer'
    },
    dueDate: '2024-08-15',
    status: 'in_progress',
    createdAt: '2024-08-10T10:30:00Z'
  },
  {
    id: 'TASK-002',
    title: 'Review video content for Brand X',
    type: 'review',
    assignedTo: {
      name: 'Lisa Davis',
      avatar: 'LD',
      role: 'QC Specialist'
    },
    dueDate: '2024-08-12',
    status: 'pending',
    createdAt: '2024-08-10T09:15:00Z'
  },
  {
    id: 'TASK-003',
    title: 'Schedule social media posts',
    type: 'schedule',
    assignedTo: {
      name: 'David Kim',
      avatar: 'DK',
      role: 'Social Media Scheduler'
    },
    dueDate: '2024-08-14',
    status: 'completed',
    createdAt: '2024-08-10T08:45:00Z'
  },
  {
    id: 'TASK-004',
    title: 'Write copy for landing page',
    type: 'copywriting',
    assignedTo: {
      name: 'Mike Johnson',
      avatar: 'MJ',
      role: 'Content Writer'
    },
    dueDate: '2024-08-11',
    status: 'in_progress',
    createdAt: '2024-08-10T07:20:00Z'
  }
];

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800'
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};

const formatDueDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Tomorrow';
  if (diffInDays > 0) return `${diffInDays} days left`;
  return `${Math.abs(diffInDays)} days overdue`;
};

interface RecentTasksCardProps {
  title?: string;
  showCreateButton?: boolean;
  onCreateTask?: () => void;
}

export function RecentTasksCard({ 
  title = "Recent Tasks", 
  showCreateButton = false,
  onCreateTask
}: RecentTasksCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {title}
          </CardTitle>
          {showCreateButton && (
            <Button size="sm" variant="outline" onClick={onCreateTask}>
              View All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border">
              <Avatar className="h-8 w-8 mt-1">
                <AvatarImage src="" />
                <AvatarFallback>{task.assignedTo.avatar}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium line-clamp-1">{task.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      Assigned to {task.assignedTo.name}
                    </p>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${statusColors[task.status]}`}
                  >
                    {task.status.replace('_', ' ')}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Due {formatDueDate(task.dueDate)}
                  </div>
                  <span>Created {formatRelativeTime(task.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
          
          {recentTasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-40" />
              <p>No recent tasks</p>
              <p className="text-sm">Tasks created will appear here</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}