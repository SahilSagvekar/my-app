// lib/upload-service.ts
import { uploadStateManager, UploadState } from './upload-state-manager';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
const PARALLEL_UPLOADS = 3; // Parallel chunk workers per file (NOT parallel files)
const SPEED_WINDOW_SIZE = 8; // Rolling window for speed calculation

type UploadEvent = 'progress' | 'completed' | 'failed' | 'paused' | 'started' | 'queued';
type UploadListener = (state: UploadState) => void;

interface QueueEntry {
    file: File;
    taskData: any;
    subfolder: string;
    folderType: string;
    relativePath?: string;
    resolve: (id: string) => void;
    reject: (err: Error) => void;
}

class UploadService {
    private listeners: Map<string, Set<{ event: UploadEvent; callback: UploadListener }>> = new Map();
    private activeUploads: Map<string, boolean> = new Map();
    private completionCallbacks: Map<string, { resolve: () => void; reject: (err: Error) => void }> = new Map();

    // FIFO Queue — uploads process one file at a time
    private uploadQueue: QueueEntry[] = [];
    private isProcessingQueue: boolean = false;

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
        fileType: string,
        maxRetries: number = 5
    ) {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
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

                const uploadResponse = await fetch(presignedUrl, {
                    method: "PUT",
                    body: chunk,
                    headers: { "Content-Type": fileType },
                });

                if (uploadResponse.status === 503) {
                    const retryAfter = parseInt(uploadResponse.headers.get('Retry-After') || '0') || 0;
                    const backoffMs = Math.max(retryAfter * 1000, Math.pow(2, attempt) * 1000 + Math.random() * 1000);
                    console.warn(`⚠️ S3 503 on part ${partNumber}, attempt ${attempt + 1}/${maxRetries}. Retrying in ${Math.round(backoffMs)}ms...`);
                    await this.sleep(backoffMs);
                    continue;
                }

                if (uploadResponse.status >= 500 && uploadResponse.status <= 599) {
                    const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                    console.warn(`⚠️ S3 ${uploadResponse.status} on part ${partNumber}, attempt ${attempt + 1}/${maxRetries}. Retrying in ${Math.round(backoffMs)}ms...`);
                    await this.sleep(backoffMs);
                    continue;
                }

                if (!uploadResponse.ok) {
                    throw new Error(`S3 Error (${uploadResponse.status})`);
                }

                const etag = uploadResponse.headers.get("ETag");
                if (!etag) throw new Error("No ETag from S3");

                return {
                    ETag: etag.replace(/"/g, ""),
                    PartNumber: partNumber,
                };
            } catch (err: any) {
                lastError = err;
                if (err.message?.includes('Failed to get presigned URL')) {
                    throw err;
                }
                const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.warn(`⚠️ Upload error on part ${partNumber}, attempt ${attempt + 1}/${maxRetries}: ${err.message}. Retrying in ${Math.round(backoffMs)}ms...`);
                await this.sleep(backoffMs);
            }
        }

        throw lastError || new Error(`S3 upload failed after ${maxRetries} attempts for part ${partNumber}`);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async detectCodec(file: File): Promise<string | null> {
        const isVideo = file.type.startsWith('video/') ||
            ['mp4', 'mkv', 'mov', 'avi', 'webm'].some(ext => file.name.toLowerCase().endsWith('.' + ext));

        if (!isVideo) return null;

        try {
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

    // ─── FIFO QUEUE: Enqueue a file for sequential upload ───
    // Returns the upload ID as soon as the file starts uploading (not after completion)
    // onIdReady callback fires immediately when the upload ID is available
    async enqueueUpload(
        file: File,
        taskData: any,
        subfolder: string,
        folderType: string = "outputs",
        relativePath?: string,
        onIdReady?: (id: string) => void
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.uploadQueue.push({
                file, taskData, subfolder, folderType, relativePath,
                resolve: (id: string) => {
                    // Notify immediately so subscriber can attach listeners before upload events fire
                    if (onIdReady) onIdReady(id);
                    resolve(id);
                },
                reject
            });
            console.log(`📥 Queued: ${file.name} (queue size: ${this.uploadQueue.length})`);

            if (!this.isProcessingQueue) {
                this.processQueue();
            }
        });
    }

    private async processQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.uploadQueue.length > 0) {
            const entry = this.uploadQueue.shift()!;
            console.log(`🚀 Processing: ${entry.file.name} (remaining in queue: ${this.uploadQueue.length})`);

            try {
                // Set up the completion promise BEFORE starting upload
                // so we can track when it finishes
                const completionPromise = new Promise<void>((resolve) => {
                    // We'll register the callback after we get the upload ID
                    (this as any)._pendingCompletionResolve = resolve;
                });

                const uploadId = await this.startUpload(
                    entry.file,
                    entry.taskData,
                    entry.subfolder,
                    undefined,
                    entry.folderType,
                    entry.relativePath
                );

                // Register the completion callback now that we have the ID
                const pendingResolve = (this as any)._pendingCompletionResolve;
                this.completionCallbacks.set(uploadId, { resolve: pendingResolve, reject: () => pendingResolve() });
                delete (this as any)._pendingCompletionResolve;

                // Resolve the entry promise IMMEDIATELY so the caller gets the ID
                // This lets UploadContext subscribe to events before they fire
                entry.resolve(uploadId);

                // Wait for this upload to fully complete before starting next file
                await completionPromise;
            } catch (err: any) {
                console.error(`❌ Queue processing failed for ${entry.file.name}:`, err);
                entry.reject(err);
            }
        }

        this.isProcessingQueue = false;
        console.log("✅ Upload queue empty");
    }

    getQueueSize(): number {
        return this.uploadQueue.length;
    }

    async startUpload(file: File, taskData: any, subfolder: string, resumeId?: string, folderType: string = "outputs", relativePath?: string) {
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
                    fileSize: file.size,
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
                relativePath,
            };

            await uploadStateManager.saveUploadState(state);
        }

        this.activeUploads.set(state.id, true);

        // Defer emit and upload start to next microtask so that callers
        // (e.g. UploadContext.onIdReady) can subscribe to events before they fire
        Promise.resolve().then(() => {
            this.emit(state.id, 'started', state);
            this.runUploadLoop(file, state, codec);
        });

        return state.id;
    }

    private async runUploadLoop(file: File, initialState: UploadState, codecProps?: string | null) {
        const { id, key, uploadId: s3UploadId } = initialState;
        const currentState = { ...initialState };
        let codec = codecProps;

        // Speed tracking: rolling window of recent chunk speeds
        const speedSamples: Array<{ bytes: number; ms: number }> = [];

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
                        const latestStatus = await uploadStateManager.getUploadState(id);
                        if (!latestStatus || latestStatus.status !== 'uploading') return;

                        const item = queue.shift();
                        if (!item) break;

                        try {
                            const chunkStart = Date.now();
                            const result = await this.uploadChunk(item.chunk, item.partNumber, key, s3UploadId, file.type);
                            const chunkDuration = Date.now() - chunkStart;

                            // Track speed sample
                            speedSamples.push({ bytes: item.chunk.size, ms: chunkDuration });
                            if (speedSamples.length > SPEED_WINDOW_SIZE) {
                                speedSamples.shift();
                            }

                            // Calculate rolling average speed
                            const totalBytes = speedSamples.reduce((s, x) => s + x.bytes, 0);
                            const totalMs = speedSamples.reduce((s, x) => s + x.ms, 0);
                            const speed = totalMs > 0 ? (totalBytes / totalMs) * 1000 : 0;
                            const remaining = currentState.fileSize - (currentState.uploadedBytes + item.chunk.size);
                            const eta = speed > 0 ? remaining / speed : 0;

                            // Update master copy
                            currentState.uploadedParts.push(result);
                            currentState.completedChunks.push(item.partNumber);
                            currentState.uploadedBytes += item.chunk.size;
                            currentState.lastUpdated = Date.now();
                            currentState.speed = speed;
                            currentState.estimatedTimeLeft = eta;

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
                    codec: codec
                }),
            });

            if (!completeResponse.ok) throw new Error("Failed to complete upload");

            await uploadStateManager.markAsCompleted(id);
            this.emit(id, 'completed', { ...currentState, status: 'completed', speed: 0, estimatedTimeLeft: 0 });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('task-updated', {
                    detail: { taskId: currentState.taskId }
                }));
            }

            // Resolve completion promise for queue processing
            const cb = this.completionCallbacks.get(id);
            if (cb) {
                cb.resolve();
                this.completionCallbacks.delete(id);
            }

        } catch (err: any) {
            console.error("Background upload loop failed:", err);
            await uploadStateManager.markAsFailed(id, err.message);
            this.emit(id, 'failed', { ...currentState, status: 'failed', error: err.message });

            // Resolve (not reject) so queue continues to next file
            const cb = this.completionCallbacks.get(id);
            if (cb) {
                cb.resolve();
                this.completionCallbacks.delete(id);
            }
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

        // Resolve completion promise so queue moves on
        const cb = this.completionCallbacks.get(id);
        if (cb) {
            cb.resolve();
            this.completionCallbacks.delete(id);
        }
    }
}

export const uploadService = new UploadService();