import { useState } from 'react';
import { CalendarIcon, Plus, Users, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Card, CardContent } from '../ui/card';
import { Separator } from '../ui/separator';
import { VisuallyHidden } from '../ui/visually-hidden';
import { useGlobalTasks } from '../workflow/GlobalTaskManager';
import { useAuth } from '../auth/AuthContext';

interface CreateTaskDialogProps {
  trigger?: React.ReactNode;
  onTaskCreated?: (task: any) => void;
}

// Mock team members data - matching authentication system user IDs
const teamMembers = [
  {
    id: '2', // matches editor@company.com
    name: 'Sarah Wilson',
    role: 'editor',
    avatar: 'SW',
    department: 'Creative',
    availability: 'available',
    currentTasks: 3
  },
  {
    id: 'ed2',
    name: 'Mike Johnson',
    role: 'editor',
    avatar: 'MJ', 
    department: 'Creative',
    availability: 'busy',
    currentTasks: 5
  },
  {
    id: '3', // matches qc@company.com
    name: 'Lisa Davis',
    role: 'qc',
    avatar: 'LD',
    department: 'Quality',
    availability: 'available',
    currentTasks: 2
  },
  {
    id: 'ed3',
    name: 'Tom Brown',
    role: 'editor',
    avatar: 'TB',
    department: 'Creative', 
    availability: 'available',
    currentTasks: 1
  },
  {
    id: '4', // matches scheduler@company.com
    name: 'Mike Johnson',
    role: 'scheduler',
    avatar: 'MJ',
    department: 'Operations',
    availability: 'busy',
    currentTasks: 4
  },
  {
    id: 'qc2',
    name: 'Alex Chen',
    role: 'qc',
    avatar: 'AC',
    department: 'Quality',
    availability: 'available',
    currentTasks: 2
  },
  {
    id: 'sch2',
    name: 'David Kim',
    role: 'scheduler',
    avatar: 'DK',
    department: 'Operations',
    availability: 'available',
    currentTasks: 2
  }
];

const taskTypes = [
  { value: 'design', label: 'Design Work', roles: ['editor'] },
  { value: 'video', label: 'Video Production', roles: ['editor'] },
  { value: 'review', label: 'Quality Review', roles: ['qc'] },
  { value: 'schedule', label: 'Schedule Planning', roles: ['scheduler'] },
  { value: 'copywriting', label: 'Copywriting', roles: ['editor'] },
  { value: 'audit', label: 'Content Audit', roles: ['qc'] },
  { value: 'coordination', label: 'Project Coordination', roles: ['scheduler'] }
];

export function CreateTaskDialog({ trigger, onTaskCreated }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    assignedTo: '',
    dueDate: '',
    estimatedHours: '',
    projectId: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  
  const { createTask } = useGlobalTasks();
  const { user } = useAuth();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Task title is required';
    }

    if (!formData.type) {
      newErrors.type = 'Task type is required';
    }

    if (!formData.assignedTo) {
      newErrors.assignedTo = 'Please assign this task to someone';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const assignedMember = teamMembers.find(m => m.id === formData.assignedTo);
      const taskType = taskTypes.find(t => t.value === formData.type);

      // Create task using GlobalTaskManager
      const newTask = createTask({
        title: formData.title,
        description: formData.description,
        type: formData.type,
        assignedTo: formData.assignedTo,
        assignedMember,
        dueDate: formData.dueDate,
        estimatedHours: formData.estimatedHours,
        projectId: formData.projectId,
        createdBy: user?.id,
        createdByName: user?.name,
        taskTypeLabel: taskType?.label
      });

      // Call the callback for backwards compatibility
      onTaskCreated?.({
        id: newTask.id,
        ...formData,
        assignedMember,
        taskType,
        status: 'pending',
        createdAt: newTask.createdAt,
        createdBy: user?.name || 'Current User'
      });
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        type: '',
        assignedTo: '',
        dueDate: '',
        estimatedHours: '',
        projectId: ''
      });
      
      setOpen(false);
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter team members based on selected task type
  const getAvailableMembers = () => {
    if (!formData.type) return teamMembers;
    
    const selectedTaskType = taskTypes.find(t => t.value === formData.type);
    if (!selectedTaskType) return teamMembers;

    return teamMembers.filter(member => 
      selectedTaskType.roles.includes(member.role)
    );
  };

  const selectedMember = teamMembers.find(m => m.id === formData.assignedTo);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="create-task-description">
        <DialogHeader>
          <DialogTitle id="create-task-title">Create New Task</DialogTitle>
          <DialogDescription id="create-task-description">
            Assign a task to your team members. Choose the appropriate role based on the task type.
          </DialogDescription>
          {user && (
            <div className="text-xs text-muted-foreground">
              Creating as: {user.name} ({user.role})
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              placeholder="Enter task title..."
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Task Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Provide detailed task instructions..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label>Task Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => {
                handleInputChange('type', value);
                // Reset assignee when task type changes
                handleInputChange('assignedTo', '');
              }}
            >
              <SelectTrigger className={errors.type ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select task type" />
              </SelectTrigger>
              <SelectContent>
                {taskTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-destructive">{errors.type}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Due Date */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleInputChange('dueDate', e.target.value)}
                className={errors.dueDate ? 'border-destructive' : ''}
                min={new Date().toISOString().split('T')[0]}
              />
              {errors.dueDate && (
                <p className="text-sm text-destructive">{errors.dueDate}</p>
              )}
            </div>

            {/* Estimated Hours */}
            <div className="space-y-2">
              <Label htmlFor="estimatedHours">Estimated Hours</Label>
              <Input
                id="estimatedHours"
                type="number"
                placeholder="e.g. 8"
                value={formData.estimatedHours}
                onChange={(e) => handleInputChange('estimatedHours', e.target.value)}
                min="0.5"
                step="0.5"
              />
            </div>
          </div>

          {/* Assign To */}
          <div className="space-y-3">
            <Label>Assign To</Label>
            {formData.type ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                  {getAvailableMembers().map((member) => (
                    <Card 
                      key={member.id}
                      className={`cursor-pointer transition-colors ${
                        formData.assignedTo === member.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => handleInputChange('assignedTo', member.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src="" />
                              <AvatarFallback>{member.avatar}</AvatarFallback>
                            </Avatar>
                            <div>
                              <h4 className="text-sm font-medium">{member.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {member.department} • {member.currentTasks} active tasks
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={member.availability === 'available' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {member.availability}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {errors.assignedTo && (
                  <p className="text-sm text-destructive">{errors.assignedTo}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a task type first to see available team members.</p>
            )}
          </div>

          {/* Selected Member Summary */}
          {selectedMember && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium mb-2">Task Assignment Summary</h4>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src="" />
                    <AvatarFallback>{selectedMember.avatar}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{selectedMember.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedMember.department} • Currently has {selectedMember.currentTasks} active tasks
                    </p>
                  </div>
                  <Badge 
                    variant={selectedMember.availability === 'available' ? 'default' : 'secondary'}
                  >
                    {selectedMember.availability}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}