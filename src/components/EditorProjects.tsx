import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Input } from './ui/input';
import { 
  Calendar, 
  Search, 
  Filter, 
  FolderOpen, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Video,
  Image as ImageIcon,
  Monitor
} from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

const projects = [
  {
    id: 'proj-001',
    title: 'Holiday Campaign 2024',
    client: 'Retail Corp',
    status: 'in-progress',
    priority: 'high',
    dueDate: '2024-08-20',
    tasksTotal: 12,
    tasksCompleted: 8,
    myTasks: 3,
    thumbnail: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400&h=300&fit=crop',
    description: 'Complete holiday marketing campaign including video ads, social media content, and email templates.',
    lastActivity: '2 hours ago',
    team: [
      { name: 'Sarah W.', avatar: 'SW' },
      { name: 'Mike J.', avatar: 'MJ' },
      { name: 'Lisa D.', avatar: 'LD' }
    ]
  },
  {
    id: 'proj-002',
    title: 'Brand Guidelines Refresh',
    client: 'Tech Startup',
    status: 'review',
    priority: 'medium',
    dueDate: '2024-08-25',
    tasksTotal: 8,
    tasksCompleted: 6,
    myTasks: 1,
    thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400&h=300&fit=crop',
    description: 'Updated brand guidelines with new color palette, typography, and logo variations.',
    lastActivity: '1 day ago',
    team: [
      { name: 'Alex C.', avatar: 'AC' },
      { name: 'Emma W.', avatar: 'EW' }
    ]
  },
  {
    id: 'proj-003',
    title: 'Q4 Social Media Campaign',
    client: 'Fashion Brand',
    status: 'planning',
    priority: 'medium',
    dueDate: '2024-09-15',
    tasksTotal: 15,
    tasksCompleted: 2,
    myTasks: 4,
    thumbnail: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=300&fit=crop',
    description: 'Comprehensive social media campaign for Q4 including Instagram, TikTok, and YouTube content.',
    lastActivity: '3 days ago',
    team: [
      { name: 'Tom B.', avatar: 'TB' },
      { name: 'Sarah W.', avatar: 'SW' },
      { name: 'David K.', avatar: 'DK' }
    ]
  },
  {
    id: 'proj-004',
    title: 'Website Redesign Assets',
    client: 'Healthcare Co',
    status: 'completed',
    priority: 'low',
    dueDate: '2024-07-30',
    tasksTotal: 10,
    tasksCompleted: 10,
    myTasks: 0,
    thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
    description: 'Complete set of web assets for healthcare company website redesign.',
    lastActivity: '1 week ago',
    team: [
      { name: 'Lisa D.', avatar: 'LD' },
      { name: 'Mike J.', avatar: 'MJ' }
    ]
  },
  {
    id: 'proj-005',
    title: 'Product Launch Videos',
    client: 'Consumer Goods',
    status: 'in-progress',
    priority: 'high',
    dueDate: '2024-08-18',
    tasksTotal: 6,
    tasksCompleted: 3,
    myTasks: 2,
    thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop',
    description: 'Product launch video series including explainer videos and testimonials.',
    lastActivity: '4 hours ago',
    team: [
      { name: 'Emma W.', avatar: 'EW' },
      { name: 'Alex C.', avatar: 'AC' }
    ]
  },
  {
    id: 'proj-006',
    title: 'Annual Report Design',
    client: 'Finance Corp',
    status: 'review',
    priority: 'medium',
    dueDate: '2024-08-30',
    tasksTotal: 4,
    tasksCompleted: 3,
    myTasks: 1,
    thumbnail: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=300&fit=crop',
    description: 'Complete annual report design with infographics and data visualizations.',
    lastActivity: '2 days ago',
    team: [
      { name: 'Tom B.', avatar: 'TB' }
    ]
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-500';
    case 'in-progress': return 'bg-blue-500';
    case 'review': return 'bg-yellow-500';
    case 'planning': return 'bg-purple-500';
    default: return 'bg-gray-400';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed': return 'Completed';
    case 'in-progress': return 'In Progress';
    case 'review': return 'In Review';
    case 'planning': return 'Planning';
    default: return 'Unknown';
  }
};

const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case 'high': return 'destructive';
    case 'medium': return 'default';
    default: return 'secondary';
  }
};

export function EditorProjects() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1>My Projects</h1>
        <p className="text-muted-foreground mt-2">
          Track your project progress and manage assignments
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'in-progress' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('in-progress')}
          >
            In Progress
          </Button>
          <Button
            variant={statusFilter === 'review' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('review')}
          >
            In Review
          </Button>
          <Button
            variant={statusFilter === 'planning' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('planning')}
          >
            Planning
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6 text-center">
            <FolderOpen className="h-8 w-8 mx-auto mb-2 text-blue-600" />
            <h3 className="text-2xl font-medium">{projects.length}</h3>
            <p className="text-sm text-muted-foreground">Total Projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
            <h3 className="text-2xl font-medium">{projects.filter(p => p.status === 'in-progress').length}</h3>
            <p className="text-sm text-muted-foreground">Active Projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
            <h3 className="text-2xl font-medium">{projects.filter(p => p.status === 'completed').length}</h3>
            <p className="text-sm text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-600" />
            <h3 className="text-2xl font-medium">{projects.reduce((acc, p) => acc + p.myTasks, 0)}</h3>
            <p className="text-sm text-muted-foreground">My Tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
            <div className="relative">
              <ImageWithFallback
                src={project.thumbnail}
                alt={project.title}
                className="w-full h-48 object-cover"
              />
              <div className="absolute top-3 left-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(project.status)}`} />
              </div>
              <div className="absolute top-3 right-3">
                <Badge variant={getPriorityVariant(project.priority)} className="text-xs">
                  {project.priority}
                </Badge>
              </div>
            </div>
            
            <CardContent className="p-4 space-y-4">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-sm line-clamp-2">{project.title}</h3>
                  <Badge variant="outline" className="text-xs ml-2">
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{project.client}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {project.description}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Progress</span>
                  <span>{project.tasksCompleted}/{project.tasksTotal} tasks</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all" 
                    style={{ width: `${(project.tasksCompleted / project.tasksTotal) * 100}%` }}
                  />
                </div>
              </div>

              {/* Team Avatars */}
              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {project.team.slice(0, 3).map((member, index) => (
                    <Avatar key={index} className="h-6 w-6 border-2 border-background">
                      <AvatarFallback className="text-[8px]">{member.avatar}</AvatarFallback>
                    </Avatar>
                  ))}
                  {project.team.length > 3 && (
                    <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                      <span className="text-[8px] text-muted-foreground">+{project.team.length - 3}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Due {project.dueDate}</span>
                </div>
              </div>

              {/* My Tasks Count */}
              {project.myTasks > 0 && (
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <span className="text-sm text-blue-700">
                    {project.myTasks} task{project.myTasks === 1 ? '' : 's'} assigned to me
                  </span>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Last activity: {project.lastActivity}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No projects found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Try adjusting your search terms.' : 'No projects match the current filters.'}
          </p>
        </div>
      )}
    </div>
  );
}