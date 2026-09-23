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
  taggedEditorIds?: string[];  // admin-selected editors to tag in Slack notification (raw footage)
  batchId?: string;            // set when 2+ files were selected together — groups Slack notifications
  batchTotal?: number;         // total files in this batch
  replaceFileId?: string;      // explicit target file to deactivate/replace (e.g. one image in a hard-post set)
  // Multipart part size in bytes. Absent on states saved before adaptive chunk
  // sizing existed — readers must fall back to the 10MB default (CHUNK_SIZE).
  chunkSize?: number;
  fileLastModified?: number;   // File.lastModified — used to verify the re-picked file on resume
  // Subset of the original taskData, so an upload that can't be resumed in place
  // (single-PUT, or an expired multipart session) can be re-initiated from scratch.
  taskSnapshot?: UploadTaskSnapshot;
}

interface UploadTaskSnapshot {
  id?: string;
  clientId?: string;
  title?: string;
  taggedEditorIds?: string[];
  batchId?: string;
  batchTotal?: number;
  replaceFileId?: string;
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
    // 'queued' = a resume waiting for a free file slot (see uploadService.resumeUpload)
    const queued = await db.getAllFromIndex('uploads', 'by-status', 'queued');
    return [...uploads, ...paused, ...queued];
  }

  async getUploadsByTask(taskId: string): Promise<UploadState[]> {
    const db = await this.init();
    return db.getAllFromIndex('uploads', 'by-task', taskId);
  }

  async deleteUploadState(id: string) {
    const db = await this.init();
    await db.delete('uploads', id);
  }

  // Read-modify-write inside ONE readwrite transaction. Several workers (and a
  // pause/cancel click) can touch the same record concurrently now that files
  // and parts upload in parallel — separate get/put calls could let a late
  // progress write resurrect a paused upload's 'uploading' status.
  async updateUploadState(id: string, fn: (state: UploadState) => void): Promise<UploadState | undefined> {
    const db = await this.init();
    const tx = db.transaction('uploads', 'readwrite');
    const state = await tx.store.get(id);
    if (state) {
      fn(state);
      state.lastUpdated = Date.now();
      await tx.store.put(state);
    }
    await tx.done;
    return state;
  }

  async updateProgress(
    id: string,
    uploadedBytes: number,
    completedChunks: number[],
    uploadedParts: Array<{ ETag: string; PartNumber: number }>
  ) {
    await this.updateUploadState(id, (state) => {
      state.uploadedBytes = uploadedBytes;
      state.completedChunks = completedChunks;
      state.uploadedParts = uploadedParts;
    });
  }

  async markAsCompleted(id: string) {
    await this.updateUploadState(id, (state) => {
      state.status = 'completed';
      state.uploadedBytes = state.fileSize; // Ensure 100%
    });
  }

  async markAsFailed(id: string, error: string) {
    await this.updateUploadState(id, (state) => {
      state.status = 'failed';
      state.error = error;
    });
  }

  async pauseUpload(id: string) {
    await this.updateUploadState(id, (state) => {
      state.status = 'paused';
    });
  }

  async resumeUpload(id: string) {
    return this.updateUploadState(id, (state) => {
      state.status = 'uploading';
    });
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
export type { UploadState, UploadTaskSnapshot };