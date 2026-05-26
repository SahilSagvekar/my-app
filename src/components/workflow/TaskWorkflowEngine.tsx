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
  parentTaskId?: string;
  files?: WorkflowFile[];
  feedback?: string;
  rejectionReason?: string;
  workflowStep: 'editing' | 'qc_review' | 'scheduling' | 'completed';
  originalTaskId?: string;
  queuePosition?: number;
  priority?: string;
  completedAt?: string;
  suggestedTitles?: any[];
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
  folderType?: string;
}

export interface TaskWorkflowEngineProps {
  onTaskCreated?: (task: WorkflowTask) => void;
  onTaskUpdated?: (task: WorkflowTask) => void;
  onWorkflowCompleted?: (originalTaskId: string) => void;
}

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
  private queueCounter: number = 0;

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

  private getNextQCReviewer(): typeof teamMembers.qc[0] {
    return teamMembers.qc[this.queueCounter % teamMembers.qc.length];
  }

  private getNextScheduler(): typeof teamMembers.scheduler[0] {
    return teamMembers.scheduler[this.queueCounter % teamMembers.scheduler.length];
  }

  private getNextQueuePosition(): number {
    return ++this.queueCounter;
  }

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
      dueDate: this.calculateDueDate(1),
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

  // ─── Updated: accepts optional qcTitle ───
  async approveQCTask(qcTask: WorkflowTask, feedback?: string, qcTitle?: string): Promise<WorkflowTask> {
    qcTask.status = 'approved';
    qcTask.feedback = feedback;
    this.tasks.set(qcTask.id, qcTask);
    this.notify(qcTask, 'updated');

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
      dueDate: this.calculateDueDate(2),
      parentTaskId: qcTask.id,
      originalTaskId: qcTask.originalTaskId,
      files: qcTask.files,
      workflowStep: 'scheduling',
      feedback,
      projectId: qcTask.projectId
    };

    this.tasks.set(schedulingTask.id, schedulingTask);
    this.notify(schedulingTask, 'created');

    console.log(`✅ Workflow: QC approved${qcTitle ? ` with title "${qcTitle}"` : ''}, created scheduling task ${schedulingTask.id} for ${scheduler.name}`);
    return schedulingTask;
  }

  async rejectQCTask(qcTask: WorkflowTask, rejectionReason: string): Promise<WorkflowTask> {
    qcTask.status = 'rejected';
    qcTask.rejectionReason = rejectionReason;
    this.tasks.set(qcTask.id, qcTask);
    this.notify(qcTask, 'updated');

    const originalTask = this.tasks.get(qcTask.parentTaskId || '');
    const editorId = originalTask?.assignedTo || 'ed1';
    const editorName = originalTask?.assignedToName || 'Editor';

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
      dueDate: this.calculateDueDate(1),
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

  async completeSchedulingTask(schedulingTask: WorkflowTask): Promise<void> {
    schedulingTask.status = 'completed';
    schedulingTask.workflowStep = 'completed';
    this.tasks.set(schedulingTask.id, schedulingTask);
    this.notify(schedulingTask, 'updated');

    if (schedulingTask.originalTaskId) {
      this.notifyWorkflowCompleted(schedulingTask.originalTaskId);
    }

    console.log(`🎉 Workflow: Scheduling completed for task ${schedulingTask.id}`);
  }

  private calculateDueDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }

  getTasksForUser(userId: string): WorkflowTask[] {
    return Array.from(this.tasks.values())
      .filter(task => task.assignedTo === userId)
      .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
  }

  getNextTaskForRole(role: string): WorkflowTask | undefined {
    const roleTasks = Array.from(this.tasks.values())
      .filter(task =>
        task.assignedToRole === role &&
        task.status === 'pending'
      )
      .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

    return roleTasks[0];
  }

  getTask(taskId: string): WorkflowTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): WorkflowTask[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
  }

  updateTask(taskId: string, updates: Partial<WorkflowTask>): WorkflowTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;

    const updatedTask = { ...task, ...updates };
    this.tasks.set(taskId, updatedTask);
    this.notify(updatedTask, 'updated');
    return updatedTask;
  }
}

// ─── React hook ───
export function useTaskWorkflow() {
  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [loading, setLoading] = useState(false);

  const workflowEngine = TaskWorkflowEngine.getInstance();

  useEffect(() => {
    const unsubscribe = workflowEngine.addListener((task, action) => {
      setTasks(prev => {
        if (action === 'created') {
          return [...prev, task];
        } else {
          return prev.map(t => t.id === task.id ? task : t);
        }
      });
    });

    setTasks(workflowEngine.getAllTasks());

    return () => { unsubscribe(); };
  }, []);

  const createQCReviewTask = async (originalTask: WorkflowTask, files: WorkflowFile[]) => {
    setLoading(true);
    try {
      return await workflowEngine.createQCReviewTask(originalTask, files);
    } finally {
      setLoading(false);
    }
  };

  // ─── Updated: accepts optional qcTitle ───
  const approveQCTask = async (qcTask: WorkflowTask, feedback?: string, qcTitle?: string) => {
    setLoading(true);
    try {
      return await workflowEngine.approveQCTask(qcTask, feedback, qcTitle);
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

export const taskWorkflowEngine = TaskWorkflowEngine.getInstance();