import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Progress } from '../ui/progress';
import { Plus, Search, Filter, Calendar, User, FileText, Clock, CheckCircle, AlertCircle, Edit, Trash2, Play, Image } from 'lucide-react';
import { Separator } from '../ui/separator';

interface ContentItem {
  id: string;
  title: string;
  description: string;
  type: 'long-form-video' | 'short-form-clip' | 'social-post' | 'custom';
  clientId: string;
  clientName: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'not-started' | 'in-progress' | 'completed';
  stages: {
    editing: {
      assignedTo: string;
      assignedToName: string;
      dueDate: string;
      status: 'not-started' | 'in-progress' | 'completed';
      startedAt?: string;
      completedAt?: string;
    };
    qc: {
      assignedTo: string;
      assignedToName: string;
      dueDate: string;
      status: 'not-started' | 'in-progress' | 'completed';
      startedAt?: string;
      completedAt?: string;
    };
    scheduling: {
      assignedTo: string;
      assignedToName: string;
      dueDate: string;
      status: 'not-started' | 'in-progress' | 'completed';
      startedAt?: string;
      completedAt?: string;
    };
  };
  createdAt: string;
  finalDueDate: string;
}

const mockContentItems: ContentItem[] = [
  {
    id: 'content-001',
    title: 'Q4 Product Launch Video',
    description: 'Create a comprehensive product launch video showcasing new features and benefits',
    type: 'long-form-video',
    clientId: 'client-001',
    clientName: 'TechStartup Inc.',
    priority: 'high',
    status: 'in-progress',
    stages: {
      editing: {
        assignedTo: 'ed1',
        assignedToName: 'John Smith',
        dueDate: '2024-09-05',
        status: 'completed',
        startedAt: '2024-08-25',
        completedAt: '2024-09-02'
      },
      qc: {
        assignedTo: 'qc1',
        assignedToName: 'Lisa Davis',
        dueDate: '2024-09-07',
        status: 'in-progress',
        startedAt: '2024-09-02'
      },
      scheduling: {
        assignedTo: 'sch1',
        assignedToName: 'Mike Johnson',
        dueDate: '2024-09-10',
        status: 'not-started'
      }
    },
    createdAt: '2024-08-20',
    finalDueDate: '2024-09-10'
  },
  {
    id: 'content-002',
    title: 'Holiday Social Media Series',
    description: 'Create 8 short-form clips for holiday marketing campaign across platforms',
    type: 'short-form-clip',
    clientId: 'client-002',
    clientName: 'EcoFriendly Solutions',
    priority: 'medium',
    status: 'not-started',
    stages: {
      editing: {
        assignedTo: 'ed2',
        assignedToName: 'Emma Wilson',
        dueDate: '2024-09-12',
        status: 'not-started'
      },
      qc: {
        assignedTo: 'qc2',
        assignedToName: 'David Chen',
        dueDate: '2024-09-15',
        status: 'not-started'
      },
      scheduling: {
        assignedTo: 'sch2',
        assignedToName: 'Sarah Kim',
        dueDate: '2024-09-18',
        status: 'not-started'
      }
    },
    createdAt: '2024-08-28',
    finalDueDate: '2024-09-18'
  },
  {
    id: 'content-003',
    title: 'Brand Awareness Posts',
    description: 'Design and create social media posts for brand awareness campaign',
    type: 'social-post',
    clientId: 'client-003',
    clientName: 'Fashion Forward',
    priority: 'urgent',
    status: 'in-progress',
    stages: {
      editing: {
        assignedTo: 'ed3',
        assignedToName: 'Alex Rodriguez',
        dueDate: '2024-09-03',
        status: 'in-progress',
        startedAt: '2024-08-30'
      },
      qc: {
        assignedTo: 'qc1',
        assignedToName: 'Lisa Davis',
        dueDate: '2024-09-05',
        status: 'not-started'
      },
      scheduling: {
        assignedTo: 'sch1',
        assignedToName: 'Mike Johnson',
        dueDate: '2024-09-06',
        status: 'not-started'
      }
    },
    createdAt: '2024-08-29',
    finalDueDate: '2024-09-06'
  }
];

const mockTeamMembers = {
  editors: [
    { id: 'ed1', name: 'John Smith' },
    { id: 'ed2', name: 'Emma Wilson' },
    { id: 'ed3', name: 'Alex Rodriguez' },
    { id: 'ed4', name: 'Maria Garcia' }
  ],
  qc: [
    { id: 'qc1', name: 'Lisa Davis' },
    { id: 'qc2', name: 'David Chen' },
    { id: 'qc3', name: 'Anna Park' }
  ],
  schedulers: [
    { id: 'sch1', name: 'Mike Johnson' },
    { id: 'sch2', name: 'Sarah Kim' },
    { id: 'sch3', name: 'Tom Wilson' }
  ]
};

const mockClients = [
  { id: 'client-001', name: 'TechStartup Inc.' },
  { id: 'client-002', name: 'EcoFriendly Solutions' },
  { id: 'client-003', name: 'Fashion Forward' },
  { id: 'client-004', name: 'Fitness Plus' }
];

export function ContentAssignment() {
  const [contentItems, setContentItems] = useState<ContentItem[]>(mockContentItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [newContent, setNewContent] = useState<Partial<ContentItem>>({
    title: '',
    description: '',
    type: 'long-form-video',
    clientId: '',
    priority: 'medium',
    finalDueDate: '',
    stages: {
      editing: { assignedTo: '', assignedToName: '', dueDate: '', status: 'not-started' },
      qc: { assignedTo: '', assignedToName: '', dueDate: '', status: 'not-started' },
      scheduling: { assignedTo: '', assignedToName: '', dueDate: '', status: 'not-started' }
    }
  });

  const filteredContentItems = contentItems.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesClient = clientFilter === 'all' || item.clientId === clientFilter;
    const matchesPriority = priorityFilter === 'all' || item.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesClient && matchesPriority;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in-progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'not-started': return <AlertCircle className="h-4 w-4 text-gray-400" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'in-progress': return 'secondary';
      case 'not-started': return 'outline';
      default: return 'outline';
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'long-form-video': return <Play className="h-4 w-4" />;
      case 'short-form-clip': return <Play className="h-4 w-4" />;
      case 'social-post': return <Image className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getOverallProgress = (stages: ContentItem['stages']) => {
    let completed = 0;
    if (stages.editing.status === 'completed') completed++;
    if (stages.qc.status === 'completed') completed++;
    if (stages.scheduling.status === 'completed') completed++;
    return (completed / 3) * 100;
  };

  const getTeamMemberName = (role: 'editors' | 'qc' | 'schedulers', id: string) => {
    const member = mockTeamMembers[role].find(m => m.id === id);
    return member?.name || '';
  };

  const handleSaveContent = () => {
    const client = mockClients.find(c => c.id === newContent.clientId);
    
    if (editingContent) {
      // Update existing content
      setContentItems(prev => prev.map(item => 
        item.id === editingContent.id 
          ? { 
              ...editingContent, 
              ...newContent,
              clientName: client?.name || '',
              status: getContentStatus(newContent.stages!)
            }
          : item
      ));
      setEditingContent(null);
    } else {
      // Add new content
      const content: ContentItem = {
        id: `content-${Date.now()}`,
        title: newContent.title || '',
        description: newContent.description || '',
        type: newContent.type as ContentItem['type'] || 'long-form-video',
        clientId: newContent.clientId || '',
        clientName: client?.name || '',
        priority: newContent.priority as ContentItem['priority'] || 'medium',
        status: 'not-started',
        stages: {
          editing: {
            ...newContent.stages!.editing,
            assignedToName: getTeamMemberName('editors', newContent.stages!.editing.assignedTo)
          },
          qc: {
            ...newContent.stages!.qc,
            assignedToName: getTeamMemberName('qc', newContent.stages!.qc.assignedTo)
          },
          scheduling: {
            ...newContent.stages!.scheduling,
            assignedToName: getTeamMemberName('schedulers', newContent.stages!.scheduling.assignedTo)
          }
        },
        createdAt: new Date().toISOString().split('T')[0],
        finalDueDate: newContent.finalDueDate || ''
      };
      setContentItems(prev => [...prev, content]);
    }
    
    // Reset form
    setNewContent({
      title: '',
      description: '',
      type: 'long-form-video',
      clientId: '',
      priority: 'medium',
      finalDueDate: '',
      stages: {
        editing: { assignedTo: '', assignedToName: '', dueDate: '', status: 'not-started' },
        qc: { assignedTo: '', assignedToName: '', dueDate: '', status: 'not-started' },
        scheduling: { assignedTo: '', assignedToName: '', dueDate: '', status: 'not-started' }
      }
    });
    setShowAddDialog(false);
  };

  const getContentStatus = (stages: ContentItem['stages']): ContentItem['status'] => {
    if (stages.scheduling.status === 'completed') return 'completed';
    if (stages.editing.status === 'in-progress' || stages.qc.status === 'in-progress' || stages.scheduling.status === 'in-progress') return 'in-progress';
    return 'not-started';
  };

  const handleEditContent = (content: ContentItem) => {
    setEditingContent(content);
    setNewContent({
      title: content.title,
      description: content.description,
      type: content.type,
      clientId: content.clientId,
      priority: content.priority,
      finalDueDate: content.finalDueDate,
      stages: content.stages
    });
    setShowAddDialog(true);
  };

  const handleDeleteContent = (contentId: string) => {
    if (confirm('Are you sure you want to delete this content item?')) {
      setContentItems(prev => prev.filter(item => item.id !== contentId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2>Content Assignment</h2>
          <p className="text-muted-foreground mt-1">
            Create and manage content items with team assignments
          </p>
        </div>

        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingContent(null);
              setNewContent({
                title: '',
                description: '',
                type: 'long-form-video',
                clientId: '',
                priority: 'medium',
                finalDueDate: '',
                stages: {
                  editing: { assignedTo: '', assignedToName: '', dueDate: '', status: 'not-started' },
                  qc: { assignedTo: '', assignedToName: '', dueDate: '', status: 'not-started' },
                  scheduling: { assignedTo: '', assignedToName: '', dueDate: '', status: 'not-started' }
                }
              });
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Content Item
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingContent ? 'Edit Content Item' : 'Add Content Item'}
              </DialogTitle>
              <DialogDescription>
                {editingContent 
                  ? 'Update content information and team assignments'
                  : 'Create a new content item and assign team members for each stage'
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Content Information */}
              <div className="space-y-4">
                <h4 className="font-medium">Content Information</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newContent.title}
                      onChange={(e) => setNewContent(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter content title"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="type">Content Type</Label>
                    <Select 
                      value={newContent.type} 
                      onValueChange={(value) => setNewContent(prev => ({ ...prev, type: value as ContentItem['type'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="long-form-video">Long-form Video</SelectItem>
                        <SelectItem value="short-form-clip">Short-form Clip</SelectItem>
                        <SelectItem value="social-post">Social Post</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newContent.description}
                    onChange={(e) => setNewContent(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the content requirements and specifications"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client">Client</Label>
                    <Select 
                      value={newContent.clientId} 
                      onValueChange={(value) => setNewContent(prev => ({ ...prev, clientId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockClients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select 
                      value={newContent.priority} 
                      onValueChange={(value) => setNewContent(prev => ({ ...prev, priority: value as ContentItem['priority'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="finalDueDate">Final Due Date</Label>
                    <Input
                      id="finalDueDate"
                      type="date"
                      value={newContent.finalDueDate}
                      onChange={(e) => setNewContent(prev => ({ ...prev, finalDueDate: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Stage Assignments */}
              <div className="space-y-4">
                <h4 className="font-medium">Team Assignments</h4>
                
                {/* Editing Stage */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h5 className="font-medium text-sm">1. Editing Stage</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editingAssignee">Assigned Editor</Label>
                      <Select 
                        value={newContent.stages?.editing.assignedTo} 
                        onValueChange={(value) => {
                          const editor = mockTeamMembers.editors.find(e => e.id === value);
                          setNewContent(prev => ({
                            ...prev,
                            stages: {
                              ...prev.stages!,
                              editing: {
                                ...prev.stages!.editing,
                                assignedTo: value,
                                assignedToName: editor?.name || ''
                              }
                            }
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select editor" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockTeamMembers.editors.map(editor => (
                            <SelectItem key={editor.id} value={editor.id}>
                              {editor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="editingDueDate">Due Date</Label>
                      <Input
                        id="editingDueDate"
                        type="date"
                        value={newContent.stages?.editing.dueDate}
                        onChange={(e) => setNewContent(prev => ({
                          ...prev,
                          stages: {
                            ...prev.stages!,
                            editing: {
                              ...prev.stages!.editing,
                              dueDate: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* QC Stage */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h5 className="font-medium text-sm">2. Quality Control Stage</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="qcAssignee">Assigned QC</Label>
                      <Select 
                        value={newContent.stages?.qc.assignedTo} 
                        onValueChange={(value) => {
                          const qc = mockTeamMembers.qc.find(q => q.id === value);
                          setNewContent(prev => ({
                            ...prev,
                            stages: {
                              ...prev.stages!,
                              qc: {
                                ...prev.stages!.qc,
                                assignedTo: value,
                                assignedToName: qc?.name || ''
                              }
                            }
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select QC reviewer" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockTeamMembers.qc.map(qc => (
                            <SelectItem key={qc.id} value={qc.id}>
                              {qc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="qcDueDate">Due Date</Label>
                      <Input
                        id="qcDueDate"
                        type="date"
                        value={newContent.stages?.qc.dueDate}
                        onChange={(e) => setNewContent(prev => ({
                          ...prev,
                          stages: {
                            ...prev.stages!,
                            qc: {
                              ...prev.stages!.qc,
                              dueDate: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Scheduling Stage */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h5 className="font-medium text-sm">3. Scheduling Stage</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="schedulingAssignee">Assigned Scheduler</Label>
                      <Select 
                        value={newContent.stages?.scheduling.assignedTo} 
                        onValueChange={(value) => {
                          const scheduler = mockTeamMembers.schedulers.find(s => s.id === value);
                          setNewContent(prev => ({
                            ...prev,
                            stages: {
                              ...prev.stages!,
                              scheduling: {
                                ...prev.stages!.scheduling,
                                assignedTo: value,
                                assignedToName: scheduler?.name || ''
                              }
                            }
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select scheduler" />
                        </SelectTrigger>
                        <SelectContent>
                          {mockTeamMembers.schedulers.map(scheduler => (
                            <SelectItem key={scheduler.id} value={scheduler.id}>
                              {scheduler.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="schedulingDueDate">Due Date</Label>
                      <Input
                        id="schedulingDueDate"
                        type="date"
                        value={newContent.stages?.scheduling.dueDate}
                        onChange={(e) => setNewContent(prev => ({
                          ...prev,
                          stages: {
                            ...prev.stages!,
                            scheduling: {
                              ...prev.stages!.scheduling,
                              dueDate: e.target.value
                            }
                          }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveContent}>
                {editingContent ? 'Update Content' : 'Create Content'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="not-started">Not Started</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-48">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {mockClients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-48">
                <AlertCircle className="h-4 w-4 mr-2" />
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

      {/* Content Items List */}
      <div className="grid gap-4">
        {filteredContentItems.map(item => (
          <Card key={item.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    {getContentTypeIcon(item.type)}
                  </div>
                  
                  <div>
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusVariant(item.status)} className="flex items-center gap-1">
                        {getStatusIcon(item.status)}
                        {item.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                      <Badge variant={getPriorityVariant(item.priority)}>
                        {item.priority.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{item.clientName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEditContent(item)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteContent(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Progress Overview */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span>{Math.round(getOverallProgress(item.stages))}% Complete</span>
                </div>
                <Progress value={getOverallProgress(item.stages)} className="h-2" />
              </div>

              {/* Stage Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Editing Stage */}
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Editing</h4>
                    <Badge variant={getStatusVariant(item.stages.editing.status)} className="text-xs">
                      {item.stages.editing.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {item.stages.editing.assignedToName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due: {new Date(item.stages.editing.dueDate).toLocaleDateString()}
                  </p>
                </div>

                {/* QC Stage */}
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Quality Control</h4>
                    <Badge variant={getStatusVariant(item.stages.qc.status)} className="text-xs">
                      {item.stages.qc.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {item.stages.qc.assignedToName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due: {new Date(item.stages.qc.dueDate).toLocaleDateString()}
                  </p>
                </div>

                {/* Scheduling Stage */}
                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">Scheduling</h4>
                    <Badge variant={getStatusVariant(item.stages.scheduling.status)} className="text-xs">
                      {item.stages.scheduling.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {item.stages.scheduling.assignedToName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Due: {new Date(item.stages.scheduling.dueDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Final Due Date */}
              <div className="mt-4 pt-3 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Final Due Date:</span>
                  <span className="font-medium">{new Date(item.finalDueDate).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredContentItems.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="mb-2">No content items found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || statusFilter !== 'all' || clientFilter !== 'all' || priorityFilter !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'Get started by creating your first content item'
              }
            </p>
            {(!searchTerm && statusFilter === 'all' && clientFilter === 'all' && priorityFilter === 'all') && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Content Item
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}