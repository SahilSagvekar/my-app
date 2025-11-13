import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback } from './ui/avatar';
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

import { 
  Send, 
  MessageSquare, 
  Clock, 
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  Search,
  Filter,
  Plus,
  Reply,
  Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';

interface FeedbackMessage {
  id: string;
  subject: string;
  message: string;
  category: 'general' | 'technical' | 'workflow' | 'suggestion' | 'bug-report';
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'acknowledged' | 'in-progress' | 'resolved';
  sender: {
    id: string;
    name: string;
    role: string;
    avatar: string;
  };
  recipients: string[];
  createdAt: string;
  responses?: FeedbackResponse[];
  attachments?: string[];
}

interface FeedbackResponse {
  id: string;
  message: string;
  sender: {
    id: string;
    name: string;
    role: string;
    avatar: string;
  };
  createdAt: string;
}

const mockFeedback: FeedbackMessage[] = [
  {
    id: 'fb-001',
    subject: 'Video Review Process Improvement',
    message: 'I think we could streamline the video review process by adding timestamped comments directly in the video player. This would make feedback more precise and actionable.',
    category: 'workflow',
    priority: 'medium',
    status: 'in-progress',
    sender: {
      id: 'ed1',
      name: 'Sarah Wilson',
      role: 'editor',
      avatar: 'SW'
    },
    recipients: ['admin', 'manager'],
    createdAt: '2024-08-09T10:30:00Z',
    responses: [
      {
        id: 'resp-001',
        message: 'Great suggestion! We\'re actually working on implementing this feature. Should be ready in the next sprint.',
        sender: {
          id: 'admin1',
          name: 'John Admin',
          role: 'admin',
          avatar: 'JA'
        },
        createdAt: '2024-08-09T14:20:00Z'
      }
    ]
  },
  {
    id: 'fb-002',
    subject: 'Template Library Missing Categories',
    message: 'Could we add more categories to the template library? Specifically looking for email signature templates and social media story templates.',
    category: 'suggestion',
    priority: 'low',
    status: 'acknowledged',
    sender: {
      id: 'ed2',
      name: 'Mike Johnson',
      role: 'editor',
      avatar: 'MJ'
    },
    recipients: ['admin', 'manager'],
    createdAt: '2024-08-08T09:15:00Z',
    responses: [
      {
        id: 'resp-002',
        message: 'Thanks for the feedback! We\'ll add these to our roadmap for Q4.',
        sender: {
          id: 'mgr1',
          name: 'Maria Manager',
          role: 'manager',
          avatar: 'MM'
        },
        createdAt: '2024-08-08T16:45:00Z'
      }
    ]
  },
  {
    id: 'fb-003',
    subject: 'QC Dashboard Bug Report',
    message: 'The task counter on the QC dashboard shows incorrect numbers. It\'s showing 12 pending reviews but I only see 8 in the actual list.',
    category: 'bug-report',
    priority: 'high',
    status: 'pending',
    sender: {
      id: 'qc1',
      name: 'Lisa Davis',
      role: 'qc',
      avatar: 'LD'
    },
    recipients: ['admin'],
    createdAt: '2024-08-07T14:30:00Z'
  }
];

const categories = [
  { value: 'general', label: 'General Feedback' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'workflow', label: 'Workflow Improvement' },
  { value: 'suggestion', label: 'Feature Suggestion' },
  { value: 'bug-report', label: 'Bug Report' }
];

const priorities = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

const statuses = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' }
];

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'general': return 'bg-blue-100 text-blue-800';
    case 'technical': return 'bg-red-100 text-red-800';
    case 'workflow': return 'bg-green-100 text-green-800';
    case 'suggestion': return 'bg-purple-100 text-purple-800';
    case 'bug-report': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'destructive';
    case 'medium': return 'default';
    case 'low': return 'secondary';
    default: return 'secondary';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending': return <Clock className="h-4 w-4" />;
    case 'acknowledged': return <Eye className="h-4 w-4" />;
    case 'in-progress': return <AlertCircle className="h-4 w-4" />;
    case 'resolved': return <CheckCircle className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-500';
    case 'acknowledged': return 'bg-blue-500';
    case 'in-progress': return 'bg-purple-500';
    case 'resolved': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

export function FeedbackSystem({ currentRole }: { currentRole: string }) {
  const [feedback, setFeedback] = useState<FeedbackMessage[]>(mockFeedback);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewFeedbackDialog, setShowNewFeedbackDialog] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackMessage | null>(null);
  const [showFeedbackDetail, setShowFeedbackDetail] = useState(false);
  
  // New feedback form state
  const [newFeedback, setNewFeedback] = useState({
    subject: '',
    message: '',
    category: 'general' as const,
    priority: 'medium' as const
  });

  // Response form state
  const [responseMessage, setResponseMessage] = useState('');

  const filteredFeedback = feedback.filter(item => {
    const matchesSearch = item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    // Show all feedback for admin/manager, only own feedback for others
    const hasAccess = ['admin', 'manager'].includes(currentRole) || item.sender.role === currentRole;
    
    return matchesSearch && matchesStatus && hasAccess;
  });

  const handleSubmitFeedback = () => {
    if (!newFeedback.subject.trim() || !newFeedback.message.trim()) {
      toast('❌ Error', {
        description: 'Please fill in both subject and message.',
      });
      return;
    }

    const feedbackMessage: FeedbackMessage = {
      id: `fb-${Date.now()}`,
      subject: newFeedback.subject,
      message: newFeedback.message,
      category: newFeedback.category,
      priority: newFeedback.priority,
      status: 'pending',
      sender: {
        id: 'current-user',
        name: getCurrentUserName(currentRole),
        role: currentRole,
        avatar: getCurrentUserAvatar(currentRole)
      },
      recipients: ['admin', 'manager'],
      createdAt: new Date().toISOString(),
      responses: []
    };

    setFeedback(prev => [feedbackMessage, ...prev]);
    
    // Reset form
    setNewFeedback({
      subject: '',
      message: '',
      category: 'general',
      priority: 'medium'
    });
    
    setShowNewFeedbackDialog(false);
    
    toast('✅ Feedback Sent', {
      description: 'Your feedback has been sent to the admin and managers.',
    });
  };

  const handleSubmitResponse = () => {
    if (!responseMessage.trim() || !selectedFeedback) return;

    const response: FeedbackResponse = {
      id: `resp-${Date.now()}`,
      message: responseMessage,
      sender: {
        id: 'current-user',
        name: getCurrentUserName(currentRole),
        role: currentRole,
        avatar: getCurrentUserAvatar(currentRole)
      },
      createdAt: new Date().toISOString()
    };

    setFeedback(prev => prev.map(item => {
      if (item.id === selectedFeedback.id) {
        return {
          ...item,
          responses: [...(item.responses || []), response],
          status: item.status === 'pending' ? 'acknowledged' : item.status
        };
      }
      return item;
    }));

    setResponseMessage('');
    
    toast('✅ Response Sent', {
      description: 'Your response has been added to the feedback thread.',
    });
  };

  const handleUpdateStatus = (feedbackId: string, newStatus: string) => {
    setFeedback(prev => prev.map(item => 
      item.id === feedbackId ? { ...item, status: newStatus as any } : item
    ));
    
    toast('✅ Status Updated', {
      description: `Feedback status updated to ${newStatus}.`,
    });
  };

  function getCurrentUserName(role: string): string {
    switch (role) {
      case 'admin': return 'John Admin';
      case 'editor': return 'Current Editor';
      case 'qc_specialist': return 'Current QC';
      case 'scheduler': return 'Current Scheduler';
      case 'manager': return 'Current Manager';
      case 'client': return 'Current Client';
      default: return 'User';
    }
  }

  function getCurrentUserAvatar(role: string): string {
    switch (role) {
      case 'admin': return 'JA';
      case 'editor': return 'CE';
      case 'qc': return 'CQ';
      case 'scheduler': return 'CS';
      case 'manager': return 'CM';
      case 'client': return 'CC';
      default: return 'U';
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1>Feedback</h1>
            <p className="text-muted-foreground mt-2">
              Send feedback to admin and managers, or view responses
            </p>
          </div>
          <Dialog open={showNewFeedbackDialog} onOpenChange={setShowNewFeedbackDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Feedback
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <VisuallyHidden>
                  <DialogTitle>Submit Feedback</DialogTitle>
                </VisuallyHidden>
                <DialogDescription>
                  Send feedback, suggestions, or report issues to the admin and management team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Subject</label>
                  <Input
                    placeholder="Brief description of your feedback..."
                    value={newFeedback.subject}
                    onChange={(e) => setNewFeedback(prev => ({ ...prev, subject: e.target.value }))}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select value={newFeedback.category} onValueChange={(value: any) => setNewFeedback(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Priority</label>
                    <Select value={newFeedback.priority} onValueChange={(value: any) => setNewFeedback(prev => ({ ...prev, priority: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map(priority => (
                          <SelectItem key={priority.value} value={priority.value}>
                            {priority.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Message</label>
                  <Textarea
                    placeholder="Describe your feedback in detail..."
                    value={newFeedback.message}
                    onChange={(e) => setNewFeedback(prev => ({ ...prev, message: e.target.value }))}
                    className="min-h-[120px]"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowNewFeedbackDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitFeedback}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Feedback
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search feedback..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {statuses.map(status => (
              <Button
                key={status.value}
                variant={statusFilter === status.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status.value)}
              >
                {status.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6 text-center">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h3 className="text-2xl font-medium">{filteredFeedback.length}</h3>
              <p className="text-sm text-muted-foreground">Total Feedback</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-600" />
              <h3 className="text-2xl font-medium">{filteredFeedback.filter(f => f.status === 'pending').length}</h3>
              <p className="text-sm text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h3 className="text-2xl font-medium">{filteredFeedback.filter(f => f.status === 'in-progress').length}</h3>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <h3 className="text-2xl font-medium">{filteredFeedback.filter(f => f.status === 'resolved').length}</h3>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Feedback List */}
        <div className="space-y-4">
          {filteredFeedback.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => {
                    setSelectedFeedback(item);
                    setShowFeedbackDetail(true);
                  }}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium">{item.subject}</h3>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`} />
                      <Badge className={getCategoryColor(item.category)}>
                        {categories.find(c => c.value === item.category)?.label}
                      </Badge>
                      <Badge variant={getPriorityColor(item.priority)}>
                        {item.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {item.message}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[8px]">{item.sender.avatar}</AvatarFallback>
                        </Avatar>
                        <span>{item.sender.name}</span>
                        <span>({item.sender.role})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                      {item.responses && item.responses.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Reply className="h-3 w-3" />
                          <span>{item.responses.length} response{item.responses.length === 1 ? '' : 's'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.status)}
                    <span className="text-xs text-muted-foreground capitalize">{item.status.replace('-', ' ')}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredFeedback.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No feedback found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Try adjusting your search terms.' : 'No feedback matches the current filters.'}
            </p>
          </div>
        )}

        {/* Feedback Detail Dialog */}
        <Dialog open={showFeedbackDetail} onOpenChange={setShowFeedbackDetail}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{selectedFeedback?.subject}</DialogTitle>
              <DialogDescription>
                View feedback details, responses, and update status or add responses.
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex items-center justify-between mb-4">
              {['admin', 'manager'].includes(currentRole) && selectedFeedback && (
                <Select value={selectedFeedback.status} onValueChange={(value) => handleUpdateStatus(selectedFeedback.id, value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="acknowledged">Acknowledged</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            
            {selectedFeedback && (
              <div className="space-y-6">
                {/* Original Message */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{selectedFeedback.sender.avatar}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{selectedFeedback.sender.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedFeedback.sender.role} • {formatDate(selectedFeedback.createdAt)}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <Badge className={getCategoryColor(selectedFeedback.category)}>
                        {categories.find(c => c.value === selectedFeedback.category)?.label}
                      </Badge>
                      <Badge variant={getPriorityColor(selectedFeedback.priority)}>
                        {selectedFeedback.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm">{selectedFeedback.message}</p>
                  </div>
                </div>

                {/* Responses */}
                {selectedFeedback.responses && selectedFeedback.responses.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium">Responses</h4>
                    <ScrollArea className="max-h-60">
                      <div className="space-y-4">
                        {selectedFeedback.responses.map((response) => (
                          <div key={response.id} className="space-y-2">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[8px]">{response.sender.avatar}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="text-sm font-medium">{response.sender.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {response.sender.role} • {formatDate(response.createdAt)}
                                </div>
                              </div>
                            </div>
                            <div className="bg-blue-50 p-3 rounded-lg ml-9">
                              <p className="text-sm">{response.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Response Form (for admin/manager) */}
                {['admin', 'manager'].includes(currentRole) && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Add Response</h4>
                    <Textarea
                      placeholder="Type your response..."
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleSubmitResponse} disabled={!responseMessage.trim()}>
                        <Send className="h-4 w-4 mr-2" />
                        Send Response
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <Toaster />
    </>
  );
}