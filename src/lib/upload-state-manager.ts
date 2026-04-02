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
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  startedAt: number;
  lastUpdated: number;
  subfolder?: string;
  error?: string;
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
  private indexedDbUnavailable = false;
  private memoryStore = new Map<string, UploadState>();

  async init() {
    if (this.db) return this.db;
    if (this.indexedDbUnavailable) return null;

    try {
      this.db = await openDB<UploadDB>('upload-manager', 1, {
        upgrade(db) {
          const uploadsStore = db.createObjectStore('uploads', { keyPath: 'id' });
          uploadsStore.createIndex('by-status', 'status');
          uploadsStore.createIndex('by-task', 'taskId');
        },
      });
    } catch (error) {
      this.indexedDbUnavailable = true;
      console.warn('IndexedDB is unavailable, falling back to in-memory upload state:', error);
      return null;
    }

    return this.db;
  }

  async saveUploadState(state: UploadState) {
    const db = await this.init();
    const nextState = {
      ...state,
      lastUpdated: Date.now(),
    };

    if (!db) {
      this.memoryStore.set(state.id, nextState);
      return;
    }

    await db.put('uploads', nextState);
  }

  async getUploadState(id: string): Promise<UploadState | undefined> {
    const db = await this.init();
    if (!db) {
      return this.memoryStore.get(id);
    }
    return db.get('uploads', id);
  }

  async getAllActiveUploads(): Promise<UploadState[]> {
    const db = await this.init();
    if (!db) {
      return Array.from(this.memoryStore.values()).filter(
        (upload) => upload.status === 'uploading' || upload.status === 'paused',
      );
    }
    const uploads = await db.getAllFromIndex('uploads', 'by-status', 'uploading');
    const paused = await db.getAllFromIndex('uploads', 'by-status', 'paused');
    return [...uploads, ...paused];
  }

  async getUploadsByTask(taskId: string): Promise<UploadState[]> {
    const db = await this.init();
    if (!db) {
      return Array.from(this.memoryStore.values()).filter((upload) => upload.taskId === taskId);
    }
    return db.getAllFromIndex('uploads', 'by-task', taskId);
  }

  async deleteUploadState(id: string) {
    const db = await this.init();
    if (!db) {
      this.memoryStore.delete(id);
      return;
    }
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
      state.lastUpdated = Date.now();
      await db.put('uploads', state);

      // Clean up chunks after completion
      setTimeout(() => this.deleteUploadState(id), 5000);
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
}

export const uploadStateManager = new UploadStateManager();
export type { UploadState };
