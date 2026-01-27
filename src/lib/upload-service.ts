// lib/upload-service.ts
import { uploadStateManager, UploadState } from './upload-state-manager';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const PARALLEL_UPLOADS = 6;

type UploadEvent = 'progress' | 'completed' | 'failed' | 'paused' | 'started';
type UploadListener = (state: UploadState) => void;

class UploadService {
    private listeners: Map<string, Set<{ event: UploadEvent; callback: UploadListener }>> = new Map();
    private activeUploads: Map<string, boolean> = new Map();

    private emit(id: string, event: UploadEvent, state: UploadState) {
        const taskListeners = this.listeners.get(id);
        if (taskListeners) {
            taskListeners.forEach(l => {
                if (l.event === event) l.callback(state);
            });
        }
    }

    on(id: string, event: UploadEvent, callback: UploadListener) {
        if (!this.listeners.has(id)) {
            this.listeners.set(id, new Set());
        }
        this.listeners.get(id)!.add({ event, callback });
    }

    off(id: string, event: UploadEvent, callback: UploadListener) {
        const taskListeners = this.listeners.get(id);
        if (taskListeners) {
            taskListeners.forEach(l => {
                if (l.event === event && l.callback === callback) {
                    taskListeners.delete(l);
                }
            });
        }
    }

    private async uploadChunk(
        chunk: Blob,
        partNumber: number,
        key: string,
        uploadId: string,
        fileType: string
    ) {
        // 1. Get Presigned URL
        const payload = JSON.stringify({ key, uploadId, partNumber });
        const partUrlResponse = await fetch(`/api/upload/part-url?t=${Date.now()}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: payload,
        });

        if (!partUrlResponse.ok) {
            const errorText = await partUrlResponse.text();
            console.error(`❌ Part URL error (${partUrlResponse.status}):`, errorText);
            throw new Error(`Failed to get presigned URL for part ${partNumber}`);
        }
        const { presignedUrl } = await partUrlResponse.json();

        // 2. Upload to S3
        const uploadResponse = await fetch(presignedUrl, {
            method: "PUT",
            body: chunk,
            headers: { "Content-Type": fileType },
        });

        if (!uploadResponse.ok) {
            throw new Error(`S3 Error (${uploadResponse.status})`);
        }

        const etag = uploadResponse.headers.get("ETag");
        if (!etag) throw new Error("No ETag from S3");

        return {
            ETag: etag.replace(/"/g, ""),
            PartNumber: partNumber,
        };
    }

    async startUpload(file: File, taskData: any, subfolder: string, resumeId?: string) {
        let state: UploadState;

        if (resumeId) {
            const existing = await uploadStateManager.getUploadState(resumeId);
            if (!existing) throw new Error("Upload state not found");
            state = existing;
            state.status = 'uploading';
            await uploadStateManager.resumeUpload(resumeId);
        } else {
            const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const initResponse = await fetch("/api/upload/initiate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type,
                    taskId: taskData.id,
                    clientId: taskData.clientId,
                    folderType: "outputs",
                    taskTitle: taskData.title,
                    subfolder,
                }),
            });

            if (!initResponse.ok) throw new Error("Failed to initiate upload");
            const initData = await initResponse.json();

            state = {
                id,
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                taskId: taskData.id,
                clientId: taskData.clientId,
                folderType: "outputs",
                uploadId: initData.uploadId,
                key: initData.key,
                uploadedParts: [],
                uploadedBytes: 0,
                totalChunks: Math.ceil(file.size / CHUNK_SIZE),
                completedChunks: [],
                status: 'uploading',
                startedAt: Date.now(),
                lastUpdated: Date.now(),
                subfolder,
            };

            await uploadStateManager.saveUploadState(state);
        }

        this.activeUploads.set(state.id, true);
        this.emit(state.id, 'started', state);

        this.runUploadLoop(file, state);

        return state.id;
    }

    private async runUploadLoop(file: File, initialState: UploadState) {
        const { id, key, uploadId: s3UploadId } = initialState;
        const currentState = { ...initialState }; // Local master copy to avoid DB race conditions

        try {
            const chunks: Array<{ chunk: Blob; partNumber: number }> = [];
            for (let i = 0; i < currentState.totalChunks; i++) {
                const partNumber = i + 1;
                if (currentState.completedChunks.includes(partNumber)) continue;

                const start = i * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                chunks.push({ chunk: file.slice(start, end), partNumber });
            }

            const queue = [...chunks];
            const workers = Array(Math.min(PARALLEL_UPLOADS, chunks.length))
                .fill(null)
                .map(async () => {
                    while (queue.length > 0) {
                        // Re-check status from DB to honor pauses
                        const latestStatus = await uploadStateManager.getUploadState(id);
                        if (!latestStatus || latestStatus.status !== 'uploading') return;

                        const item = queue.shift();
                        if (!item) break;

                        try {
                            const result = await this.uploadChunk(item.chunk, item.partNumber, key, s3UploadId, file.type);

                            // Update master copy
                            currentState.uploadedParts.push(result);
                            currentState.completedChunks.push(item.partNumber);
                            currentState.uploadedBytes += item.chunk.size;
                            currentState.lastUpdated = Date.now();

                            // Save and emit
                            await uploadStateManager.updateProgress(id, currentState.uploadedBytes, currentState.completedChunks, currentState.uploadedParts);
                            this.emit(id, 'progress', { ...currentState });
                        } catch (err: any) {
                            console.error(`Worker error for part ${item.partNumber}:`, err);
                            throw err;
                        }
                    }
                });

            await Promise.all(workers);

            const finalCheck = await uploadStateManager.getUploadState(id);
            if (!finalCheck || finalCheck.status !== 'uploading') return;

            if (currentState.completedChunks.length < currentState.totalChunks) {
                // Some chunks missed? Should not happen if workers throw correctly
                return;
            }

            // Complete
            currentState.uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);
            const completeResponse = await fetch("/api/upload/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    key: currentState.key,
                    uploadId: currentState.uploadId,
                    parts: currentState.uploadedParts,
                    fileName: currentState.fileName,
                    fileSize: currentState.fileSize,
                    fileType: currentState.fileType,
                    taskId: currentState.taskId,
                    subfolder: currentState.subfolder || 'main'
                }),
            });

            if (!completeResponse.ok) throw new Error("Failed to complete upload");

            await uploadStateManager.markAsCompleted(id);
            this.emit(id, 'completed', { ...currentState, status: 'completed' });

        } catch (err: any) {
            console.error("Background upload loop failed:", err);
            await uploadStateManager.markAsFailed(id, err.message);
            this.emit(id, 'failed', { ...currentState, status: 'failed', error: err.message });
        } finally {
            this.activeUploads.delete(id);
        }
    }

    async pauseUpload(id: string) {
        await uploadStateManager.pauseUpload(id);
        const state = await uploadStateManager.getUploadState(id);
        if (state) this.emit(id, 'paused', state);
    }

    async cancelUpload(id: string) {
        const state = await uploadStateManager.getUploadState(id);
        if (state) {
            await fetch("/api/upload/abort", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key: state.key, uploadId: state.uploadId }),
            });
        }
        await uploadStateManager.deleteUploadState(id);
        this.activeUploads.delete(id);
    }
}

export const uploadService = new UploadService();
