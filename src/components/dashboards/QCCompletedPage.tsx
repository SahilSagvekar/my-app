import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CheckCircle, XCircle, FileCheck, Calendar, FileText, Video, Palette, User, ArrowRight, Search, Filter, UserCheck } from 'lucide-react';

type TaskStatus = 'approved' | 'rejected';
type TaskCategory = 'design' | 'video' | 'copywriting' | 'review';
type TaskDestination = 'editor' | 'client' | 'scheduler';

interface CompletedTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  createdAt: string;
  projectId?: string;
  taskCategory?: TaskCategory;
  nextDestination?: TaskDestination;
  feedback?: string;
}

// Mock completed tasks
const mockCompletedTasks: CompletedTask[] = [
  {
    id: 'QC-C001',
    title: 'Product Launch Video',
    description: 'Reviewed and approved product launch video',
    status: 'approved',
    createdAt: '2024-11-10T10:00:00Z',
    projectId: 'proj-100',
    taskCategory: 'video',
    nextDestination: 'client'
  },
  {
    id: 'QC-C002',
    title: 'Website Banner Design',
    description: 'Reviewed and rejected - requested color corrections',
    status: 'rejected',
    createdAt: '2024-11-10T11:30:00Z',
    projectId: 'proj-101',
    taskCategory: 'design',
    nextDestination: 'editor',
    feedback: 'Brand colors not matching style guide. Please adjust to exact hex values.'
  },
  {
    id: 'QC-C003',
    title: 'Email Newsletter Template',
    description: 'Reviewed and approved newsletter design',
    status: 'approved',
    createdAt: '2024-11-09T14:00:00Z',
    projectId: 'proj-102',
    taskCategory: 'design',
    nextDestination: 'scheduler'
  },
  {
    id: 'QC-C004',
    title: 'Testimonial Video',
    description: 'Reviewed and approved customer testimonial',
    status: 'approved',
    createdAt: '2024-11-09T09:15:00Z',
    projectId: 'proj-103',
    taskCategory: 'video',
    nextDestination: 'client'
  },
  {
    id: 'QC-C005',
    title: 'Social Media Graphics Pack',
    description: 'Reviewed and rejected - text alignment issues',
    status: 'rejected',
    createdAt: '2024-11-08T16:00:00Z',
    projectId: 'proj-104',
    taskCategory: 'design',
    nextDestination: 'editor',
    feedback: 'Text alignment inconsistent across all graphics. Please ensure all text follows 8px grid.'
  },
  {
    id: 'QC-C006',
    title: 'Holiday Campaign Video',
    description: 'Reviewed and approved for client review',
    status: 'approved',
    createdAt: '2024-11-08T14:20:00Z',
    projectId: 'proj-105',
    taskCategory: 'video',
    nextDestination: 'client'
  },
  {
    id: 'QC-C007',
    title: 'Instagram Story Templates',
    description: 'Reviewed and approved',
    status: 'approved',
    createdAt: '2024-11-07T10:45:00Z',
    projectId: 'proj-106',
    taskCategory: 'design',
    nextDestination: 'scheduler'
  },
  {
    id: 'QC-C008',
    title: 'Product Demo Video',
    description: 'Reviewed and rejected - audio issues',
    status: 'rejected',
    createdAt: '2024-11-07T09:30:00Z',
    projectId: 'proj-107',
    taskCategory: 'video',
    nextDestination: 'editor',
    feedback: 'Background music too loud. Voice-over needs to be clearer. Please remix audio.'
  }
];

export function QCCompletedPage() {
  const [completedFilter, setCompletedFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [completedSearchTerm, setCompletedSearchTerm] = useState('');
  const [completedTasks] = useState<CompletedTask[]>(mockCompletedTasks);

  const totalCompleted = completedTasks.length;
  const approvedCount = completedTasks.filter(t => t.status === 'approved').length;
  const rejectedCount = completedTasks.filter(t => t.status === 'rejected').length;
  const approvalRate = totalCompleted > 0 ? ((approvedCount / totalCompleted) * 100).toFixed(1) : '0';

  // Filter completed tasks
  const filteredCompletedTasks = completedTasks.filter(task => {
    const matchesFilter = completedFilter === 'all' || task.status === completedFilter;
    const matchesSearch = task.title.toLowerCase().includes(completedSearchTerm.toLowerCase()) ||
                         task.projectId?.toLowerCase().includes(completedSearchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
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
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reviewed</p>
                <h3>{totalCompleted}</h3>
              </div>
              <FileCheck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <h3 className="text-green-600">{approvedCount}</h3>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <h3 className="text-red-600">{rejectedCount}</h3>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approval Rate</p>
                <h3>{approvalRate}%</h3>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
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
                <SelectItem value="approved">Approved Only</SelectItem>
                <SelectItem value="rejected">Rejected Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Completed Tasks List */}
      <Card>
        <CardHeader>
          <CardTitle>Review History ({filteredCompletedTasks.length})</CardTitle>
          <CardDescription>Recent review outcomes and feedback</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompletedTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileCheck className="h-16 w-16 mx-auto mb-4 opacity-40" />
              <h3 className="mb-2">No Completed Reviews</h3>
              <p>Completed reviews will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCompletedTasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(task.status)}
                        <h4 className="font-medium">{task.title}</h4>
                        <Badge variant={task.status === 'approved' ? 'default' : 'destructive'}>
                          {task.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">{task.id}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {getTaskCategoryIcon(task.taskCategory)}
                          <span className="capitalize">{task.taskCategory}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                        </div>
                        {task.projectId && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            <span>Project: {task.projectId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {task.nextDestination && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs flex-shrink-0 ${getDestinationColor(task.nextDestination)}`}>
                        {getDestinationIcon(task.nextDestination)}
                        <span className="capitalize">→ {task.nextDestination}</span>
                      </div>
                    )}
                  </div>
                  {task.feedback && (
                    <div className="mt-3 p-3 bg-accent/50 rounded">
                      <p className="text-sm font-medium mb-1">Feedback Provided:</p>
                      <p className="text-sm text-muted-foreground">{task.feedback}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
