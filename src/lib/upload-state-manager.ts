// lib/upload-state-manager.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface UploadState {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  taskId: string;
  clientId: string;
  folderType: string;
  uploadId: string;
  key: string;
  uploadedParts: Array<{ ETag: string; PartNumber: number }>;
  uploadedBytes: number;
  totalChunks: number;
  completedChunks: number[];
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed' | 'queued';
  startedAt: number;
  lastUpdated: number;
  subfolder?: string;
  error?: string;
  // Speed & ETA tracking
  speed?: number;              // bytes/sec (rolling average)
  estimatedTimeLeft?: number;  // seconds remaining
  relativePath?: string;       // for folder uploads — relative path within the folder
}

interface UploadDB extends DBSchema {
  uploads: {
    key: string;
    value: UploadState;
    indexes: { 'by-status': string; 'by-task': string };
  };
}

class UploadStateManager {
  private db: IDBPDatabase<UploadDB> | null = null;

  async init() {
    if (this.db) return this.db;

    this.db = await openDB<UploadDB>('upload-manager', 1, {
      upgrade(db) {
        // Create uploads store
        const uploadsStore = db.createObjectStore('uploads', { keyPath: 'id' });
        uploadsStore.createIndex('by-status', 'status');
        uploadsStore.createIndex('by-task', 'taskId');
      },
    });

    return this.db;
  }

  async saveUploadState(state: UploadState) {
    const db = await this.init();
    await db.put('uploads', {
      ...state,
      lastUpdated: Date.now(),
    });
  }

  async getUploadState(id: string): Promise<UploadState | undefined> {
    const db = await this.init();
    return db.get('uploads', id);
  }

  async getAllActiveUploads(): Promise<UploadState[]> {
    const db = await this.init();
    const uploads = await db.getAllFromIndex('uploads', 'by-status', 'uploading');
    const paused = await db.getAllFromIndex('uploads', 'by-status', 'paused');
    return [...uploads, ...paused];
  }

  async getUploadsByTask(taskId: string): Promise<UploadState[]> {
    const db = await this.init();
    return db.getAllFromIndex('uploads', 'by-task', taskId);
  }

  async deleteUploadState(id: string) {
    const db = await this.init();
    await db.delete('uploads', id);
  }

  async updateProgress(
    id: string,
    uploadedBytes: number,
    completedChunks: number[],
    uploadedParts: Array<{ ETag: string; PartNumber: number }>
  ) {
    const db = await this.init();
    const state = await this.getUploadState(id);
    if (state) {
      state.uploadedBytes = uploadedBytes;
      state.completedChunks = completedChunks;
      state.uploadedParts = uploadedParts;
      state.lastUpdated = Date.now();
      await db.put('uploads', state);
    }
  }

  async markAsCompleted(id: string) {
    const db = await this.init();
    const state = await this.getUploadState(id);
    if (state) {
      state.status = 'completed';
      state.uploadedBytes = state.fileSize; // Ensure 100%
      state.lastUpdated = Date.now();
      await db.put('uploads', state);
    }
  }

  async markAsFailed(id: string, error: string) {
    const db = await this.init();
    const state = await this.getUploadState(id);
    if (state) {
      state.status = 'failed';
      state.error = error;
      state.lastUpdated = Date.now();
      await db.put('uploads', state);
    }
  }

  async pauseUpload(id: string) {
    const db = await this.init();
    const state = await this.getUploadState(id);
    if (state) {
      state.status = 'paused';
      state.lastUpdated = Date.now();
      await db.put('uploads', state);
    }
  }

  async resumeUpload(id: string) {
    const db = await this.init();
    const state = await this.getUploadState(id);
    if (state) {
      state.status = 'uploading';
      state.lastUpdated = Date.now();
      await db.put('uploads', state);
    }
    return state;
  }

  async clearCompleted(): Promise<void> {
    const db = await this.init();
    const completed = await db.getAllFromIndex('uploads', 'by-status', 'completed');
    for (const upload of completed) {
      await db.delete('uploads', upload.id);
    }
  }

  async getAllUploads(): Promise<UploadState[]> {
    const db = await this.init();
    return db.getAll('uploads');
  }
}

export const uploadStateManager = new UploadStateManager();
export type { UploadState };