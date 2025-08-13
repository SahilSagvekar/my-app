import { useState, useEffect, useCallback } from 'react';
import { WorkflowTask, WorkflowFile } from './TaskWorkflowEngine';

// Extended interface for tasks created by admin/manager
export interface GlobalTask extends Omit<WorkflowTask, 'type' | 'workflowStep' | 'assignedToRole'> {
  type: 'edit' | 'qc_review' | 'scheduling' | 'design' | 'video' | 'review' | 'schedule' | 'copywriting' | 'audit' | 'coordination';
  workflowStep: 'editing' | 'qc_review' | 'scheduling' | 'completed';
  assignedToRole: 'editor' | 'qc' | 'scheduler';
  createdBy?: string;
  createdByName?: string;
  estimatedHours?: number;
  taskTypeLabel?: string;
}

// Team member mapping for role assignment
const roleMapping: Record<string, string> = {
  'design': 'editor',
  'video': 'editor', 
  'copywriting': 'editor',
  'review': 'qc',
  'audit': 'qc',
  'schedule': 'scheduler',
  'coordination': 'scheduler'
};

class GlobalTaskManager {
  private static instance: GlobalTaskManager;
  private tasks: Map<string, GlobalTask> = new Map();
  private listeners: Set<(tasks: GlobalTask[]) => void> = new Set();
  private storageKey = 'pm_global_tasks';
  private isInitialized = false;

  static getInstance(): GlobalTaskManager {
    if (!GlobalTaskManager.instance) {
      GlobalTaskManager.instance = new GlobalTaskManager();
    }
    return GlobalTaskManager.instance;
  }

  constructor() {
    // Don't load from storage in constructor - wait for client-side initialization
  }

  // Initialize on client-side only
  private initializeIfNeeded() {
    if (!this.isInitialized && typeof window !== 'undefined') {
      this.loadFromStorage();
      this.isInitialized = true;
    }
  }

  private loadFromStorage() {
    // Check if we're on the client side
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const tasksArray: GlobalTask[] = JSON.parse(stored);
        tasksArray.forEach(task => {
          this.tasks.set(task.id, task);
        });
      }
    } catch (error) {
      console.error('Error loading tasks from storage:', error);
    }
  }

  private saveToStorage() {
    // Check if we're on the client side
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    
    try {
      const tasksArray = Array.from(this.tasks.values());
      localStorage.setItem(this.storageKey, JSON.stringify(tasksArray));
    } catch (error) {
      console.error('Error saving tasks to storage:', error);
    }
  }

  private notifyListeners() {
    const tasksArray = Array.from(this.tasks.values());
    this.listeners.forEach(callback => callback(tasksArray));
  }

  addListener(callback: (tasks: GlobalTask[]) => void): () => void {
    this.initializeIfNeeded(); // Initialize when first listener is added
    this.listeners.add(callback);
    // Immediately call with current tasks
    callback(Array.from(this.tasks.values()));
    return () => this.listeners.delete(callback);
  }

  // Create a task from admin/manager dialog
  createTask(taskData: {
    title: string;
    description: string;
    type: string;
    assignedTo: string;
    assignedMember?: any;
    dueDate: string;
    estimatedHours?: string;
    projectId?: string;
    createdBy?: string;
    createdByName?: string;
    taskTypeLabel?: string;
  }): GlobalTask {
    this.initializeIfNeeded(); // Initialize when first action is taken
    
    const assignedRole = roleMapping[taskData.type] || 'editor';
    
    const task: GlobalTask = {
      id: `TASK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: taskData.title,
      description: taskData.description,
      type: taskData.type as GlobalTask['type'],
      status: 'pending',
      assignedTo: taskData.assignedTo,
      assignedToName: taskData.assignedMember?.name || 'Unknown',
      assignedToRole: assignedRole as GlobalTask['assignedToRole'],
      createdAt: new Date().toISOString(),
      dueDate: taskData.dueDate,
      workflowStep: 'editing',
      projectId: taskData.projectId,
      createdBy: taskData.createdBy,
      createdByName: taskData.createdByName,
      estimatedHours: taskData.estimatedHours ? parseFloat(taskData.estimatedHours) : undefined,
      taskTypeLabel: taskData.taskTypeLabel
    };

    this.tasks.set(task.id, task);
    this.saveToStorage();
    this.notifyListeners();

    console.log(`✅ GlobalTaskManager: Created task ${task.id} for ${task.assignedToName} (${task.assignedToRole})`);
    return task;
  }

  // Get tasks for a specific user
  getTasksForUser(userId: string): GlobalTask[] {
    this.initializeIfNeeded();
    return Array.from(this.tasks.values()).filter(task => task.assignedTo === userId);
  }

  // Get tasks by role
  getTasksByRole(role: string): GlobalTask[] {
    this.initializeIfNeeded();
    return Array.from(this.tasks.values()).filter(task => task.assignedToRole === role);
  }

  // Get all tasks
  getAllTasks(): GlobalTask[] {
    this.initializeIfNeeded();
    return Array.from(this.tasks.values());
  }

  // Update a task
  updateTask(taskId: string, updates: Partial<GlobalTask>): GlobalTask | null {
    this.initializeIfNeeded();
    
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`Task ${taskId} not found for update`);
      return null;
    }

    const updatedTask = { ...task, ...updates };
    this.tasks.set(taskId, updatedTask);
    this.saveToStorage();
    this.notifyListeners();

    console.log(`🔄 GlobalTaskManager: Updated task ${taskId}`, updates);
    return updatedTask;
  }

  // Delete a task
  deleteTask(taskId: string): boolean {
    this.initializeIfNeeded();
    
    const existed = this.tasks.has(taskId);
    if (existed) {
      this.tasks.delete(taskId);
      this.saveToStorage();
      this.notifyListeners();
      console.log(`🗑️ GlobalTaskManager: Deleted task ${taskId}`);
    }
    return existed;
  }

  // Get task by ID
  getTask(taskId: string): GlobalTask | undefined {
    this.initializeIfNeeded();
    return this.tasks.get(taskId);
  }

  // Convert GlobalTask to WorkflowTask (for compatibility with existing workflow)
  toWorkflowTask(task: GlobalTask): WorkflowTask {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type === 'design' || task.type === 'video' || task.type === 'copywriting' ? 'edit' : 
            task.type === 'review' || task.type === 'audit' ? 'qc_review' : 'scheduling',
      status: task.status,
      assignedTo: task.assignedTo,
      assignedToName: task.assignedToName,
      assignedToRole: task.assignedToRole,
      createdAt: task.createdAt,
      dueDate: task.dueDate,
      workflowStep: task.workflowStep,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      files: task.files,
      feedback: task.feedback,
      rejectionReason: task.rejectionReason,
      originalTaskId: task.originalTaskId
    };
  }

  // Clear all tasks (for testing/demo purposes)
  clearAllTasks(): void {
    this.initializeIfNeeded();
    
    this.tasks.clear();
    this.saveToStorage();
    this.notifyListeners();
    console.log('🧹 GlobalTaskManager: Cleared all tasks');
  }
}

// React hook for using the global task manager
export function useGlobalTasks() {
  const [tasks, setTasks] = useState<GlobalTask[]>([]);
  const [loading, setLoading] = useState(false);

  const taskManager = GlobalTaskManager.getInstance();

  useEffect(() => {
    const unsubscribe = taskManager.addListener((updatedTasks) => {
      setTasks(updatedTasks);
    });

    return unsubscribe;
  }, []);

  const createTask = useCallback((taskData: Parameters<typeof taskManager.createTask>[0]) => {
    setLoading(true);
    try {
      return taskManager.createTask(taskData);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<GlobalTask>) => {
    setLoading(true);
    try {
      return taskManager.updateTask(taskId, updates);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setLoading(true);
    try {
      return taskManager.deleteTask(taskId);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTasksForUser = useCallback((userId: string) => {
    return taskManager.getTasksForUser(userId);
  }, []);

  const getTasksByRole = useCallback((role: string) => {
    return taskManager.getTasksByRole(role);
  }, []);

  const clearAllTasks = useCallback(() => {
    taskManager.clearAllTasks();
  }, []);

  return {
    tasks,
    loading,
    createTask,
    updateTask,
    deleteTask,
    getTasksForUser,
    getTasksByRole,
    clearAllTasks,
    getTask: taskManager.getTask.bind(taskManager)
  };
}

// Export singleton instance
export const globalTaskManager = GlobalTaskManager.getInstance();
