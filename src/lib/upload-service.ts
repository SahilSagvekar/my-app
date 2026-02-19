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

    private async detectCodec(file: File): Promise<string | null> {
        const isVideo = file.type.startsWith('video/') ||
            ['mp4', 'mkv', 'mov', 'avi', 'webm'].some(ext => file.name.toLowerCase().endsWith('.' + ext));

        if (!isVideo) return null;

        try {
            // Read first 1MB to find codec headers
            const buffer = await file.slice(0, 1024 * 1024).arrayBuffer();
            const bytes = new Uint8Array(buffer);

            const search = (pattern: string) => {
                const p = pattern.split('').map(c => c.charCodeAt(0));
                for (let i = 0; i < bytes.length - 4; i++) {
                    if (bytes[i] === p[0] && bytes[i + 1] === p[1] && bytes[i + 2] === p[2] && bytes[i + 3] === p[3]) return true;
                }
                return false;
            };

            if (search('avc1')) return 'H.264';
            if (search('hvc1') || search('hev1')) return 'H.265';
            if (search('vp09')) return 'VP9';
            if (search('av01')) return 'AV1';
            if (search('isom')) return 'MP4 (Unknown Codec)';

            return 'Unknown';
        } catch (e) {
            console.error("Codec detection error:", e);
            return 'Detection Failed';
        }
    }

    async startUpload(file: File, taskData: any, subfolder: string, resumeId?: string, folderType: string = "outputs") {
        let state: UploadState;

        const isVideo = file.type.startsWith('video/') ||
            ['mp4', 'mkv', 'mov', 'avi', 'webm'].some(ext => file.name.toLowerCase().endsWith('.' + ext));

        let codec: string | null = null;
        if (isVideo) {
            console.log("🎥 Identifying video codec for:", file.name);
            codec = await this.detectCodec(file);
        }

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
                    taskId: taskData?.id || "drive-upload",
                    clientId: taskData?.clientId || "unknown",
                    folderType,
                    taskTitle: taskData?.title || "",
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
                taskId: taskData?.id || "drive-upload",
                clientId: taskData?.clientId || "unknown",
                folderType,
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

        this.runUploadLoop(file, state, codec);

        return state.id;
    }

    private async runUploadLoop(file: File, initialState: UploadState, codecProps?: string | null) {
        const { id, key, uploadId: s3UploadId } = initialState;
        const currentState = { ...initialState }; // Local master copy to avoid DB race conditions
        let codec = codecProps;

        // If resuming and we don't have a codec yet, try identifying it
        if (!codec && file.type.startsWith('video/')) {
            codec = await this.detectCodec(file);
        }

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
                    subfolder: currentState.subfolder || 'main',
                    codec: codec // 🔥 Pass the detected codec
                }),
            });

            if (!completeResponse.ok) throw new Error("Failed to complete upload");

            await uploadStateManager.markAsCompleted(id);
            this.emit(id, 'completed', { ...currentState, status: 'completed' });

            // Dispatch global event for UI refreshes
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('task-updated', {
                    detail: { taskId: currentState.taskId }
                }));
            }

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
