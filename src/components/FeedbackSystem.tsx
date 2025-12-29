"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Avatar, AvatarFallback } from './ui/avatar';
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useAuth } from './auth/AuthContext';

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
  Eye,
  Loader2
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
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNewFeedbackDialog, setShowNewFeedbackDialog] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackMessage | null>(null);
  const [showFeedbackDetail, setShowFeedbackDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // New feedback form state
  const [newFeedback, setNewFeedback] = useState({
    subject: '',
    message: '',
    category: 'general' as const,
    priority: 'medium' as const
  });

  // Response form state
  const [responseMessage, setResponseMessage] = useState('');

  // Helper function to get initials from name
  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // Load feedback on mount
  useEffect(() => {
    if (user?.id) {
      loadFeedback();
    }
  }, [user?.id, currentRole]);

  async function loadFeedback() {
    try {
      setLoading(true);
      const res = await fetch(`/api/feedback?userId=${user?.id}&userRole=${currentRole}`);
      
      if (!res.ok) {
        throw new Error('Failed to fetch feedback');
      }

      const data = await res.json();

      const formatted: FeedbackMessage[] = data.feedback.map((f: any) => ({
        id: f.id,
        subject: f.subject,
        message: f.message,
        category: f.category,
        priority: f.priority,
        status: f.status,
        sender: {
          id: String(f.sender.id),
          name: f.sender.name,
          role: f.sender.role,
          avatar: getInitials(f.sender.name),
        },
        recipients: ['admin', 'manager'],
        createdAt: f.createdAt,
        responses: f.responses?.map((r: any) => ({
          id: r.id,
          message: r.message,
          sender: {
            id: String(r.sender.id),
            name: r.sender.name,
            role: r.sender.role,
            avatar: getInitials(r.sender.name),
          },
          createdAt: r.createdAt,
        })) || [],
      }));

      setFeedback(formatted);
    } catch (error) {
      console.error("Failed to load feedback:", error);
      toast.error('Failed to load feedback', {
        description: 'Please try refreshing the page.',
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredFeedback = feedback.filter(item => {
    const matchesSearch = item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleSubmitFeedback = async () => {
    if (!newFeedback.subject.trim() || !newFeedback.message.trim()) {
      toast.error('Error', {
        description: 'Please fill in both subject and message.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newFeedback,
          senderId: user?.id,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit feedback');
      }

      const data = await res.json();

      const feedbackMessage: FeedbackMessage = {
        id: data.feedback.id,
        subject: data.feedback.subject,
        message: data.feedback.message,
        category: data.feedback.category,
        priority: data.feedback.priority,
        status: data.feedback.status,
        sender: {
          id: String(data.feedback.sender.id),
          name: data.feedback.sender.name,
          role: data.feedback.sender.role,
          avatar: getInitials(data.feedback.sender.name),
        },
        recipients: ['admin', 'manager'],
        createdAt: data.feedback.createdAt,
        responses: [],
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
      
      toast.success('Feedback Sent', {
        description: 'Your feedback has been sent to the admin and managers.',
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error('Error', {
        description: 'Failed to send feedback. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!responseMessage.trim() || !selectedFeedback) return;

    try {
      setSubmitting(true);
      const res = await fetch(`/api/feedback/${selectedFeedback.id}/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: responseMessage,
          senderId: user?.id,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit response');
      }

      const data = await res.json();

      const response: FeedbackResponse = {
        id: data.response.id,
        message: data.response.message,
        sender: {
          id: String(data.response.sender.id),
          name: data.response.sender.name,
          role: data.response.sender.role,
          avatar: getInitials(data.response.sender.name),
        },
        createdAt: data.response.createdAt,
      };

      setFeedback(prev => prev.map(item => {
        if (item.id === selectedFeedback.id) {
          return {
            ...item,
            responses: [...(item.responses || []), response],
            status: 'acknowledged',
          };
        }
        return item;
      }));

      // Update selected feedback to show new response immediately
      setSelectedFeedback(prev => prev ? {
        ...prev,
        responses: [...(prev.responses || []), response],
        status: 'acknowledged',
      } : null);

      setResponseMessage('');
      
      toast.success('Response Sent', {
        description: 'Your response has been added to the feedback thread.',
      });
    } catch (error) {
      console.error('Failed to submit response:', error);
      toast.error('Error', {
        description: 'Failed to send response. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (feedbackId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/feedback/${feedbackId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        throw new Error('Failed to update status');
      }

      setFeedback(prev => prev.map(item => 
        item.id === feedbackId ? { ...item, status: newStatus as any } : item
      ));

      // Update selected feedback if it's the one being updated
      if (selectedFeedback?.id === feedbackId) {
        setSelectedFeedback(prev => prev ? { ...prev, status: newStatus as any } : null);
      }
      
      toast.success('Status Updated', {
        description: `Feedback status updated to ${newStatus.replace('-', ' ')}.`,
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Error', {
        description: 'Failed to update status. Please try again.',
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1>Feedback</h1>
            <p className="text-muted-foreground mt-2">
              {currentRole === 'admin' || currentRole === 'manager' 
                ? 'View and respond to feedback from team members'
                : 'Send feedback to admin and managers, or view responses'}
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
                <DialogTitle>Submit Feedback</DialogTitle>
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
                    disabled={submitting}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select 
                      value={newFeedback.category} 
                      onValueChange={(value: any) => setNewFeedback(prev => ({ ...prev, category: value }))}
                      disabled={submitting}
                    >
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
                    <Select 
                      value={newFeedback.priority} 
                      onValueChange={(value: any) => setNewFeedback(prev => ({ ...prev, priority: value }))}
                      disabled={submitting}
                    >
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
                    disabled={submitting}
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowNewFeedbackDialog(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitFeedback} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Feedback
                      </>
                    )}
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
          <div className="flex gap-2 flex-wrap">
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
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
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
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
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
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedFeedback?.subject}</DialogTitle>
              <DialogDescription>
                View feedback details, responses, and {currentRole === 'admin' || currentRole === 'manager' ? 'update status or add responses' : 'view admin responses'}.
              </DialogDescription>
            </DialogHeader>
            
            {['admin', 'manager'].includes(currentRole) && selectedFeedback && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Status:</label>
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
                </div>
              </div>
            )}
            
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
                    <div className="flex gap-2 ml-auto flex-wrap">
                      <Badge className={getCategoryColor(selectedFeedback.category)}>
                        {categories.find(c => c.value === selectedFeedback.category)?.label}
                      </Badge>
                      <Badge variant={getPriorityColor(selectedFeedback.priority)}>
                        {selectedFeedback.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{selectedFeedback.message}</p>
                  </div>
                </div>

                {/* Responses */}
                {selectedFeedback.responses && selectedFeedback.responses.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium">Responses ({selectedFeedback.responses.length})</h4>
                    <ScrollArea className="max-h-60">
                      <div className="space-y-4 pr-4">
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
                              <p className="text-sm whitespace-pre-wrap">{response.message}</p>
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
                      disabled={submitting}
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSubmitResponse} 
                        disabled={!responseMessage.trim() || submitting}
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send Response
                          </>
                        )}
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