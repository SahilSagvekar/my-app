import { useState, useEffect } from 'react';

export interface WorkflowTask {
  id: string;
  title: string;
  description: string;
  type: 'edit' | 'qc_review' | 'scheduling';
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'approved';
  assignedTo: string;
  assignedToName: string;
  assignedToRole: string;
  createdAt: string;
  dueDate: string;
  clientId?: string;
  projectId?: string;
  parentTaskId?: string; // For tracking related tasks in the workflow
  files?: WorkflowFile[];
  feedback?: string;
  rejectionReason?: string;
  workflowStep: 'editing' | 'qc_review' | 'scheduling' | 'completed';
  originalTaskId?: string; // Track the original editing task
  queuePosition?: number; // For FIFO ordering
}

export interface WorkflowFile {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  driveFileId?: string;
  mimeType: string;
  size: number;
}

export interface TaskWorkflowEngineProps {
  onTaskCreated?: (task: WorkflowTask) => void;
  onTaskUpdated?: (task: WorkflowTask) => void;
  onWorkflowCompleted?: (originalTaskId: string) => void;
}

// Mock team members - in real app this would come from API
const teamMembers = {
  qc: [
    { id: 'qc1', name: 'Lisa Davis', role: 'qc' },
    { id: 'qc2', name: 'Alex Chen', role: 'qc' }
  ],
  scheduler: [
    { id: 'sch1', name: 'Emma White', role: 'scheduler' },
    { id: 'sch2', name: 'David Kim', role: 'scheduler' }
  ],
  editor: [
    { id: 'ed1', name: 'Sarah Wilson', role: 'editor' },
    { id: 'ed2', name: 'Mike Johnson', role: 'editor' }
  ]
};

export class TaskWorkflowEngine {
  private static instance: TaskWorkflowEngine;
  private tasks: Map<string, WorkflowTask> = new Map();
  private listeners: Set<(task: WorkflowTask, action: 'created' | 'updated') => void> = new Set();
  private workflowListeners: Set<(originalTaskId: string) => void> = new Set();
  private queueCounter: number = 0; // For FIFO ordering

  static getInstance(): TaskWorkflowEngine {
    if (!TaskWorkflowEngine.instance) {
      TaskWorkflowEngine.instance = new TaskWorkflowEngine();
    }
    return TaskWorkflowEngine.instance;
  }

  addListener(callback: (task: WorkflowTask, action: 'created' | 'updated') => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  addWorkflowListener(callback: (originalTaskId: string) => void) {
    this.workflowListeners.add(callback);
    return () => this.workflowListeners.delete(callback);
  }

  private notify(task: WorkflowTask, action: 'created' | 'updated') {
    this.listeners.forEach(callback => callback(task, action));
  }

  private notifyWorkflowCompleted(originalTaskId: string) {
    this.workflowListeners.forEach(callback => callback(originalTaskId));
  }

  // Get next available QC reviewer (FIFO assignment)
  private getNextQCReviewer(): typeof teamMembers.qc[0] {
    // In a real system, this would check who has the least tasks or is available
    // For now, using simple round-robin
    return teamMembers.qc[this.queueCounter % teamMembers.qc.length];
  }

  // Get next available scheduler (FIFO assignment)
  private getNextScheduler(): typeof teamMembers.scheduler[0] {
    // In a real system, this would check who has the least tasks or is available
    // For now, using simple round-robin
    return teamMembers.scheduler[this.queueCounter % teamMembers.scheduler.length];
  }

  // Get next queue position
  private getNextQueuePosition(): number {
    return ++this.queueCounter;
  }

  // Create QC review task when editor uploads files
  async createQCReviewTask(originalTask: WorkflowTask, files: WorkflowFile[]): Promise<WorkflowTask> {
    const qcReviewer = this.getNextQCReviewer();
    
    const qcTask: WorkflowTask = {
      id: `QC-${Date.now()}`,
      title: `QC Review: ${originalTask.title}`,
      description: `Review uploaded files for: ${originalTask.title}\n\nOriginal task description: ${originalTask.description}`,
      type: 'qc_review',
      status: 'pending',
      queuePosition: this.getNextQueuePosition(),
      assignedTo: qcReviewer.id,
      assignedToName: qcReviewer.name,
      assignedToRole: qcReviewer.role,
      createdAt: new Date().toISOString(),
      dueDate: this.calculateDueDate(1), // QC gets 1 day
      parentTaskId: originalTask.id,
      originalTaskId: originalTask.originalTaskId || originalTask.id,
      files,
      workflowStep: 'qc_review',
      projectId: originalTask.projectId
    };

    this.tasks.set(qcTask.id, qcTask);
    this.notify(qcTask, 'created');

    console.log(`🔄 Workflow: Created QC review task ${qcTask.id} for ${qcReviewer.name}`);
    return qcTask;
  }

  // Handle QC approval - create scheduling task
  async approveQCTask(qcTask: WorkflowTask, feedback?: string): Promise<WorkflowTask> {
    // Update QC task status
    qcTask.status = 'approved';
    qcTask.feedback = feedback;
    this.tasks.set(qcTask.id, qcTask);
    this.notify(qcTask, 'updated');

    // Create scheduling task
    const scheduler = this.getNextScheduler();
    
    const schedulingTask: WorkflowTask = {
      id: `SCH-${Date.now()}`,
      title: `Schedule: ${qcTask.title.replace('QC Review: ', '')}`,
      description: `Schedule approved content: ${qcTask.title.replace('QC Review: ', '')}\n\nQC Feedback: ${feedback || 'Approved without comments'}`,
      type: 'scheduling',
      status: 'pending',
      queuePosition: this.getNextQueuePosition(),
      assignedTo: scheduler.id,
      assignedToName: scheduler.name,
      assignedToRole: scheduler.role,
      createdAt: new Date().toISOString(),
      dueDate: this.calculateDueDate(2), // Scheduler gets 2 days
      parentTaskId: qcTask.id,
      originalTaskId: qcTask.originalTaskId,
      files: qcTask.files,
      workflowStep: 'scheduling',
      feedback,
      projectId: qcTask.projectId
    };

    this.tasks.set(schedulingTask.id, schedulingTask);
    this.notify(schedulingTask, 'created');

    console.log(`✅ Workflow: QC approved, created scheduling task ${schedulingTask.id} for ${scheduler.name}`);
    return schedulingTask;
  }

  // Handle QC rejection - create revision task for editor
  async rejectQCTask(qcTask: WorkflowTask, rejectionReason: string): Promise<WorkflowTask> {
    // Update QC task status
    qcTask.status = 'rejected';
    qcTask.rejectionReason = rejectionReason;
    this.tasks.set(qcTask.id, qcTask);
    this.notify(qcTask, 'updated');

    // Find original editor from parent task
    const originalTask = this.tasks.get(qcTask.parentTaskId || '');
    const editorId = originalTask?.assignedTo || 'ed1';
    const editorName = originalTask?.assignedToName || 'Editor';

    // Create revision task for original editor
    const revisionTask: WorkflowTask = {
      id: `REV-${Date.now()}`,
      title: `Revision Required: ${qcTask.title.replace('QC Review: ', '')}`,
      description: `Revisions needed for: ${qcTask.title.replace('QC Review: ', '')}\n\nQC Feedback: ${rejectionReason}\n\nPlease address the feedback and re-upload the files.`,
      type: 'edit',
      status: 'pending',
      queuePosition: this.getNextQueuePosition(),
      assignedTo: editorId,
      assignedToName: editorName,
      assignedToRole: 'editor',
      createdAt: new Date().toISOString(),
      dueDate: this.calculateDueDate(1), // Editor gets 1 day for revisions
      parentTaskId: qcTask.id,
      originalTaskId: qcTask.originalTaskId,
      files: qcTask.files,
      workflowStep: 'editing',
      rejectionReason,
      projectId: qcTask.projectId
    };

    this.tasks.set(revisionTask.id, revisionTask);
    this.notify(revisionTask, 'created');

    console.log(`❌ Workflow: QC rejected, created revision task ${revisionTask.id} for ${editorName}`);
    return revisionTask;
  }

  // Complete scheduling task - end of workflow
  async completeSchedulingTask(schedulingTask: WorkflowTask): Promise<void> {
    schedulingTask.status = 'completed';
    schedulingTask.workflowStep = 'completed';
    this.tasks.set(schedulingTask.id, schedulingTask);
    this.notify(schedulingTask, 'updated');

    // Notify workflow completion
    if (schedulingTask.originalTaskId) {
      this.notifyWorkflowCompleted(schedulingTask.originalTaskId);
    }

    console.log(`🎉 Workflow: Scheduling completed for task ${schedulingTask.id}`);
  }

  // Helper method to calculate due dates
  private calculateDueDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }

  // Get all tasks for a specific user, sorted by queue position (FIFO)
  getTasksForUser(userId: string): WorkflowTask[] {
    return Array.from(this.tasks.values())
      .filter(task => task.assignedTo === userId)
      .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0)); // FIFO ordering
  }

  // Get next task in queue for a specific role
  getNextTaskForRole(role: string): WorkflowTask | undefined {
    const roleTasks = Array.from(this.tasks.values())
      .filter(task => 
        task.assignedToRole === role && 
        task.status === 'pending'
      )
      .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
    
    return roleTasks[0]; // Return the next task in queue
  }

  // Get task by ID
  getTask(taskId: string): WorkflowTask | undefined {
    return this.tasks.get(taskId);
  }

  // Get all tasks, sorted by queue position
  getAllTasks(): WorkflowTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
  }

  // Update task
  updateTask(taskId: string, updates: Partial<WorkflowTask>): WorkflowTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    const updatedTask = { ...task, ...updates };
    this.tasks.set(taskId, updatedTask);
    this.notify(updatedTask, 'updated');
    return updatedTask;
  }
}

// React hook for using the workflow engine
export function useTaskWorkflow() {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(false);

  const workflowEngine = TaskWorkflowEngine.getInstance();

  useEffect(() => {
    // Listen for task updates
    const unsubscribe = workflowEngine.addListener((task, action) => {
      setTasks(prev => {
        if (action === 'created') {
          return [...prev, task];
        } else {
          return prev.map(t => t.id === task.id ? task : t);
        }
      });
    });

    // Load initial tasks
    setTasks(workflowEngine.getAllTasks());

    return unsubscribe;
  }, []);

  const createQCReviewTask = async (originalTask: WorkflowTask, files: WorkflowFile[]) => {
    setLoading(true);
    try {
      return await workflowEngine.createQCReviewTask(originalTask, files);
    } finally {
      setLoading(false);
    }
  };

  const approveQCTask = async (qcTask: WorkflowTask, feedback?: string) => {
    setLoading(true);
    try {
      return await workflowEngine.approveQCTask(qcTask, feedback);
    } finally {
      setLoading(false);
    }
  };

  const rejectQCTask = async (qcTask: WorkflowTask, rejectionReason: string) => {
    setLoading(true);
    try {
      return await workflowEngine.rejectQCTask(qcTask, rejectionReason);
    } finally {
      setLoading(false);
    }
  };

  const completeSchedulingTask = async (schedulingTask: WorkflowTask) => {
    setLoading(true);
    try {
      await workflowEngine.completeSchedulingTask(schedulingTask);
    } finally {
      setLoading(false);
    }
  };

  const getTasksForUser = (userId: string) => {
    return workflowEngine.getTasksForUser(userId);
  };

  const getNextTaskForRole = (role: string) => {
    return workflowEngine.getNextTaskForRole(role);
  };

  const updateTask = (taskId: string, updates: Partial<WorkflowTask>) => {
    return workflowEngine.updateTask(taskId, updates);
  };

  const getQueueStatus = () => {
    const allTasks = workflowEngine.getAllTasks();
    return {
      totalTasks: allTasks.length,
      editingQueue: allTasks.filter(t => t.workflowStep === 'editing' && t.status === 'pending').length,
      qcQueue: allTasks.filter(t => t.workflowStep === 'qc_review' && t.status === 'pending').length,
      schedulingQueue: allTasks.filter(t => t.workflowStep === 'scheduling' && t.status === 'pending').length,
      completed: allTasks.filter(t => t.workflowStep === 'completed').length
    };
  };

  return {
    tasks,
    loading,
    createQCReviewTask,
    approveQCTask,
    rejectQCTask,
    completeSchedulingTask,
    getTasksForUser,
    getNextTaskForRole,
    updateTask,
    getQueueStatus
  };
}

// Export the singleton instance for direct access
export const taskWorkflowEngine = TaskWorkflowEngine.getInstance();