import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Calendar, List, ChevronLeft, ChevronRight, Building, CheckCircle, Clock, AlertTriangle, Filter, FileText, Play, Image } from 'lucide-react';

interface ClientDeliverable {
  id: string;
  clientId: string;
  clientName: string;
  month: string;
  year: number;
  deliverables: {
    longFormVideos: { planned: number; completed: number; inProgress: number };
    shortFormClips: { planned: number; completed: number; inProgress: number };
    socialPosts: { planned: number; completed: number; inProgress: number };
    custom: { name: string; planned: number; completed: number; inProgress: number }[];
  };
  dueDate: string;
  status: 'on-track' | 'at-risk' | 'overdue' | 'completed';
  accountManager: string;
  lastUpdated: string;
}

const mockDeliverables: ClientDeliverable[] = [
  {
    id: 'del-001',
    clientId: 'client-001',
    clientName: 'TechStartup Inc.',
    month: 'September',
    year: 2024,
    deliverables: {
      longFormVideos: { planned: 4, completed: 2, inProgress: 1 },
      shortFormClips: { planned: 8, completed: 6, inProgress: 2 },
      socialPosts: { planned: 16, completed: 12, inProgress: 3 },
      custom: [
        { name: 'Strategy Consultation', planned: 1, completed: 1, inProgress: 0 }
      ]
    },
    dueDate: '2024-09-30',
    status: 'on-track',
    accountManager: 'Alex Chen',
    lastUpdated: '2024-08-30'
  },
  {
    id: 'del-002',
    clientId: 'client-002',
    clientName: 'EcoFriendly Solutions',
    month: 'September',
    year: 2024,
    deliverables: {
      longFormVideos: { planned: 2, completed: 1, inProgress: 0 },
      shortFormClips: { planned: 6, completed: 3, inProgress: 1 },
      socialPosts: { planned: 12, completed: 8, inProgress: 2 },
      custom: [
        { name: 'Brand Guidelines Update', planned: 1, completed: 0, inProgress: 1 }
      ]
    },
    dueDate: '2024-09-30',
    status: 'at-risk',
    accountManager: 'Sarah Wilson',
    lastUpdated: '2024-08-29'
  },
  {
    id: 'del-003',
    clientId: 'client-003',
    clientName: 'Fashion Forward',
    month: 'September',
    year: 2024,
    deliverables: {
      longFormVideos: { planned: 6, completed: 2, inProgress: 2 },
      shortFormClips: { planned: 12, completed: 4, inProgress: 3 },
      socialPosts: { planned: 24, completed: 18, inProgress: 4 },
      custom: [
        { name: 'Influencer Content', planned: 4, completed: 1, inProgress: 2 },
        { name: 'Trend Reports', planned: 4, completed: 4, inProgress: 0 }
      ]
    },
    dueDate: '2024-09-30',
    status: 'on-track',
    accountManager: 'David Park',
    lastUpdated: '2024-08-30'
  },
  {
    id: 'del-004',
    clientId: 'client-004',
    clientName: 'Fitness Plus',
    month: 'August',
    year: 2024,
    deliverables: {
      longFormVideos: { planned: 3, completed: 3, inProgress: 0 },
      shortFormClips: { planned: 9, completed: 9, inProgress: 0 },
      socialPosts: { planned: 18, completed: 18, inProgress: 0 },
      custom: [
        { name: 'Workout Guides', planned: 2, completed: 2, inProgress: 0 }
      ]
    },
    dueDate: '2024-08-31',
    status: 'completed',
    accountManager: 'Lisa Rodriguez',
    lastUpdated: '2024-08-31'
  }
];

export function DeliverablesOverview() {
  const [viewType, setViewType] = useState<'calendar' | 'list'>('list');
  const [selectedMonth, setSelectedMonth] = useState('2024-09');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentDate, setCurrentDate] = useState(new Date(2024, 8, 1)); // September 2024

  const filteredDeliverables = mockDeliverables.filter(deliverable => {
    const matchesMonth = `${deliverable.year}-${String(new Date(Date.parse(deliverable.month + " 1, 2024")).getMonth() + 1).padStart(2, '0')}` === selectedMonth;
    const matchesStatus = statusFilter === 'all' || deliverable.status === statusFilter;
    return matchesMonth && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'on-track': return 'text-blue-600';
      case 'at-risk': return 'text-yellow-600';
      case 'overdue': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'on-track': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'at-risk': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'on-track': return 'secondary';
      case 'at-risk': return 'secondary';
      case 'overdue': return 'destructive';
      default: return 'outline';
    }
  };

  const calculateOverallProgress = (deliverables: ClientDeliverable['deliverables']) => {
    let totalPlanned = 0;
    let totalCompleted = 0;

    totalPlanned += deliverables.longFormVideos.planned;
    totalCompleted += deliverables.longFormVideos.completed;
    
    totalPlanned += deliverables.shortFormClips.planned;
    totalCompleted += deliverables.shortFormClips.completed;
    
    totalPlanned += deliverables.socialPosts.planned;
    totalCompleted += deliverables.socialPosts.completed;

    deliverables.custom.forEach(custom => {
      totalPlanned += custom.planned;
      totalCompleted += custom.completed;
    });

    return totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => null);

  const getDeliverablesForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredDeliverables.filter(del => del.dueDate === dateStr);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const CalendarView = () => (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-3 bg-muted/50 text-center text-sm font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month starts */}
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="h-24 border-b border-r border-border/50"></div>
          ))}

          {/* Days of the month */}
          {days.map(day => {
            const dayDeliverables = getDeliverablesForDate(day);
            const hasDeliverables = dayDeliverables.length > 0;
            
            return (
              <div
                key={day}
                className={`h-24 border-b border-r border-border/50 p-2 ${
                  isToday(day) ? 'bg-primary/5 border-primary/20' : ''
                }`}
              >
                <div className={`text-sm mb-1 ${isToday(day) ? 'font-medium text-primary' : ''}`}>
                  {day}
                </div>
                
                {hasDeliverables && (
                  <div className="space-y-1">
                    {dayDeliverables.slice(0, 2).map((deliverable) => (
                      <div
                        key={deliverable.id}
                        className={`p-1 rounded text-xs border cursor-pointer ${
                          deliverable.status === 'completed' ? 'bg-green-50 border-green-200' :
                          deliverable.status === 'on-track' ? 'bg-blue-50 border-blue-200' :
                          deliverable.status === 'at-risk' ? 'bg-yellow-50 border-yellow-200' :
                          'bg-red-50 border-red-200'
                        }`}
                        title={`${deliverable.clientName} - ${deliverable.status}`}
                      >
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          <span className="truncate">{deliverable.clientName}</span>
                        </div>
                        <div className="text-xs opacity-75">
                          {calculateOverallProgress(deliverable.deliverables)}% complete
                        </div>
                      </div>
                    ))}
                    
                    {dayDeliverables.length > 2 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayDeliverables.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar Legend */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-200 rounded border border-green-300"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-200 rounded border border-blue-300"></div>
          <span>On Track</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-200 rounded border border-yellow-300"></div>
          <span>At Risk</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-200 rounded border border-red-300"></div>
          <span>Overdue</span>
        </div>
      </div>
    </div>
  );

  const ListView = () => (
    <div className="space-y-4">
      {filteredDeliverables.map(deliverable => (
        <Card key={deliverable.id}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Building className="h-6 w-6 text-primary" />
                </div>
                
                <div>
                  <h3 className="font-medium">{deliverable.clientName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {deliverable.month} {deliverable.year} Deliverables
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Account Manager: {deliverable.accountManager}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(deliverable.status)} className="flex items-center gap-1">
                  {getStatusIcon(deliverable.status)}
                  {deliverable.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Due: {new Date(deliverable.dueDate).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Overall Progress */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span className="font-medium">{calculateOverallProgress(deliverable.deliverables)}% Complete</span>
              </div>
              <Progress value={calculateOverallProgress(deliverable.deliverables)} className="h-2" />
            </div>

            {/* Deliverables Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Long-form Videos */}
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Play className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">Long-form Videos</h4>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed:</span>
                    <span>{deliverable.deliverables.longFormVideos.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">In Progress:</span>
                    <span>{deliverable.deliverables.longFormVideos.inProgress}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-medium">Total Planned:</span>
                    <span className="font-medium">{deliverable.deliverables.longFormVideos.planned}</span>
                  </div>
                </div>
              </div>

              {/* Short-form Clips */}
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Play className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">Short-form Clips</h4>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed:</span>
                    <span>{deliverable.deliverables.shortFormClips.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">In Progress:</span>
                    <span>{deliverable.deliverables.shortFormClips.inProgress}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-medium">Total Planned:</span>
                    <span className="font-medium">{deliverable.deliverables.shortFormClips.planned}</span>
                  </div>
                </div>
              </div>

              {/* Social Posts */}
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Image className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">Social Posts</h4>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed:</span>
                    <span>{deliverable.deliverables.socialPosts.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">In Progress:</span>
                    <span>{deliverable.deliverables.socialPosts.inProgress}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-medium">Total Planned:</span>
                    <span className="font-medium">{deliverable.deliverables.socialPosts.planned}</span>
                  </div>
                </div>
              </div>

              {/* Custom Deliverables */}
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h4 className="font-medium text-sm">Custom Items</h4>
                </div>
                <div className="space-y-2 text-sm">
                  {deliverable.deliverables.custom.map((custom, index) => (
                    <div key={index} className="pb-2 border-b border-border/50 last:border-0">
                      <p className="font-medium text-xs mb-1">{custom.name}</p>
                      <div className="flex justify-between text-xs">
                        <span>{custom.completed}/{custom.planned}</span>
                        <span className="text-muted-foreground">
                          {custom.inProgress > 0 && `(${custom.inProgress} in progress)`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
              Last updated: {new Date(deliverable.lastUpdated).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2>Deliverables Overview</h2>
          <p className="text-muted-foreground mt-1">
            Track client deliverables and progress across all projects
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2024-09">September 2024</SelectItem>
              <SelectItem value="2024-08">August 2024</SelectItem>
              <SelectItem value="2024-07">July 2024</SelectItem>
              <SelectItem value="2024-06">June 2024</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on-track">On Track</SelectItem>
              <SelectItem value="at-risk">At Risk</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-1 border rounded-md">
            <Button
              variant={viewType === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewType('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewType === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewType('calendar')}
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <Card>
        <CardContent className="p-6">
          {viewType === 'calendar' ? <CalendarView /> : <ListView />}
        </CardContent>
      </Card>

      {filteredDeliverables.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="mb-2">No deliverables found</h3>
            <p className="text-muted-foreground mb-4">
              No deliverables found for the selected month and filters
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}