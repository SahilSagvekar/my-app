// lib/upload-service.ts
import { uploadStateManager, UploadState, UploadTaskSnapshot } from './upload-state-manager';

// Browser often reports file.type as '' for .mov and some other formats
// when files come from folder drag-and-drop or webkitdirectory picker.
function inferMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const map: Record<string, string> = {
        mov: 'video/quicktime',
        mp4: 'video/mp4',
        mkv: 'video/x-matroska',
        avi: 'video/x-msvideo',
        webm: 'video/webm',
        m4v: 'video/x-m4v',
        mts: 'video/mp2t',
        m2ts: 'video/mp2t',
        wmv: 'video/x-ms-wmv',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        pdf: 'application/pdf',
    };
    return map[ext] || 'application/octet-stream';
}

const MiB = 1024 * 1024;
const CHUNK_SIZE = 10 * MiB; // Default / minimum part size (10MB). States saved without `chunkSize` used this.
const MAX_PARTS_TARGET = 9000; // R2 allows at most 10,000 parts — keep headroom
const PARALLEL_UPLOADS = 3; // Parallel chunk workers per file
const MAX_CONCURRENT_FILES = 4; // Files in flight at once from the queue
const MAX_INFLIGHT_PARTS = 6; // GLOBAL cap on concurrent part (and single) PUTs across all files
const PART_URL_BATCH_SIZE = 20; // Part URLs presigned per /api/upload/part-urls call
const SPEED_WINDOW_SIZE = 8; // Rolling window for speed calculation

const SESSION_EXPIRED_MESSAGE = 'Upload session expired — start this file again';

// Part size grows for huge files so they stay under R2's 10,000-part limit
// (and make fewer part requests): max(10MB, fileSize / 9000 rounded UP to a whole MiB).
function chooseChunkSize(fileSize: number): number {
    const perPart = Math.ceil(fileSize / MAX_PARTS_TARGET);
    return Math.max(CHUNK_SIZE, Math.ceil(perPart / MiB) * MiB);
}

function snapshotTask(taskData: any): UploadTaskSnapshot | undefined {
    if (!taskData) return undefined;
    return {
        id: taskData.id,
        clientId: taskData.clientId,
        title: taskData.title,
        taggedEditorIds: taskData.taggedEditorIds,
        batchId: taskData.batchId,
        batchTotal: taskData.batchTotal,
        replaceFileId: taskData.replaceFileId,
    };
}

type CodedError = Error & { code?: string };

function codedError(message: string, code: string): CodedError {
    const err: CodedError = new Error(message);
    err.code = code;
    return err;
}

// Minimal async counting semaphore. acquire() resolves with a release function;
// a released slot is handed straight to the next waiter (FIFO).
class Semaphore {
    private available: number;
    private waiters: Array<() => void> = [];

    constructor(max: number) {
        this.available = max;
    }

    async acquire(): Promise<() => void> {
        if (this.available > 0) {
            this.available--;
        } else {
            await new Promise<void>(resolve => this.waiters.push(resolve));
        }
        let released = false;
        return () => {
            if (released) return;
            released = true;
            const next = this.waiters.shift();
            if (next) next();
            else this.available++;
        };
    }
}

type UploadEvent = 'progress' | 'completed' | 'failed' | 'paused' | 'started' | 'queued';
type UploadListener = (state: UploadState) => void;

interface QueueEntry {
    file: File;
    taskData: any;
    subfolder: string;
    folderType: string;
    relativePath?: string;
    resumeId?: string; // set for a multipart resume waiting for a file slot
    resolve: (id: string) => void;
    reject: (err: Error) => void;
}

// Everything a part upload needs; completedChunks is the loop's live list
interface PartRunContext {
    id: string;
    key: string;
    uploadId: string;
    fileType: string;
    totalChunks: number;
    completedChunks: number[];
    signal: AbortSignal;
}

interface PreparedUpload {
    id: string;
    // Emits 'started' and runs the upload; resolves when it completes, fails,
    // pauses or is cancelled (never rejects).
    launch: () => Promise<void>;
}

/** An AbortSignal that fires when `parent` aborts OR after `ms`. */
function withTimeout(parent: AbortSignal, ms: number): { signal: AbortSignal; clear: () => void } {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), ms);
    return {
        signal: controller.signal,
        clear: () => {
            clearTimeout(timer);
            parent.removeEventListener('abort', onAbort);
        },
    };
}

class UploadService {
    // Resume ids currently being set up from the queue (see runQueueEntry)
    private expectQueued = new Set<string>();
    private listeners: Map<string, Set<{ event: UploadEvent; callback: UploadListener }>> = new Map();
    private activeUploads: Map<string, boolean> = new Map();

    // FIFO Queue — files START in order, up to MAX_CONCURRENT_FILES run at once
    private uploadQueue: QueueEntry[] = [];
    private activeFileSlots = 0;

    // Shared by every upload: at most MAX_INFLIGHT_PARTS PUTs on the wire
    private partSlots = new Semaphore(MAX_INFLIGHT_PARTS);

    // File objects by upload id, so a paused/failed upload can resume without re-picking
    private files: Map<string, File> = new Map();
    // Aborts in-flight PUTs on pause/cancel/failure
    private controllers: Map<string, AbortController> = new Map();
    // Running upload loops (resolve when the loop has fully wound down)
    private runningLoops: Map<string, Promise<void>> = new Map();
    // Presigned part URLs by upload id → part number, plus batch fetches in flight
    private partUrlCache: Map<string, Map<number, string>> = new Map();
    private partUrlBatches: Map<string, Array<{ parts: Set<number>; promise: Promise<void> }>> = new Map();
    // Upload ids with a resumeUpload() call in progress
    private resuming: Set<string> = new Set();

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

    hasFileInMemory(id: string): boolean {
        return this.files.has(id);
    }

    // ─── Part URLs: batched + cached per upload ───

    private async fetchSinglePartUrl(run: PartRunContext, partNumber: number): Promise<string> {
        const payload = JSON.stringify({ key: run.key, uploadId: run.uploadId, partNumber });
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
        return presignedUrl;
    }

    // Never throws — on failure the caller falls back to the single-part route
    private async fetchPartUrlBatch(run: PartRunContext, partNumbers: number[], cache: Map<number, string>): Promise<void> {
        try {
            const res = await fetch(`/api/upload/part-urls?t=${Date.now()}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ key: run.key, uploadId: run.uploadId, partNumbers }),
            });
            if (!res.ok) {
                const errorText = await res.text().catch(() => res.statusText);
                console.warn(`⚠️ Batch part URL error (${res.status}): ${errorText} — falling back to single part URLs`);
                return;
            }
            const { urls } = (await res.json()) as { urls: Record<string, string> };
            for (const [partNumber, url] of Object.entries(urls || {})) {
                if (url) cache.set(Number(partNumber), url);
            }
        } catch (err: any) {
            console.warn(`⚠️ Batch part URL request failed: ${err?.message} — falling back to single part URLs`);
        }
    }

    private async getPresignedPartUrl(run: PartRunContext, partNumber: number): Promise<string> {
        let cache = this.partUrlCache.get(run.id);
        if (!cache) {
            cache = new Map();
            this.partUrlCache.set(run.id, cache);
        }
        const cached = cache.get(partNumber);
        if (cached) return cached;

        // Another worker may already be fetching a batch that covers this part
        const pending = this.partUrlBatches.get(run.id)?.find(b => b.parts.has(partNumber));
        if (pending) {
            await pending.promise;
        } else {
            // Prefetch up to PART_URL_BATCH_SIZE not-yet-completed parts starting at this one
            const completed = new Set(run.completedChunks);
            const parts: number[] = [partNumber];
            for (let p = partNumber + 1; p <= run.totalChunks && parts.length < PART_URL_BATCH_SIZE; p++) {
                if (completed.has(p) || cache.has(p)) continue;
                parts.push(p);
            }
            const batch = { parts: new Set(parts), promise: this.fetchPartUrlBatch(run, parts, cache) };
            const batches = this.partUrlBatches.get(run.id) || [];
            batches.push(batch);
            this.partUrlBatches.set(run.id, batches);
            try {
                await batch.promise;
            } finally {
                const remaining = (this.partUrlBatches.get(run.id) || []).filter(b => b !== batch);
                if (remaining.length) this.partUrlBatches.set(run.id, remaining);
                else this.partUrlBatches.delete(run.id);
            }
        }

        const batched = cache.get(partNumber);
        if (batched) return batched;

        // Batch route failed (or skipped this part) — one-off presign
        const url = await this.fetchSinglePartUrl(run, partNumber);
        cache.set(partNumber, url);
        return url;
    }

    private async uploadChunk(
        run: PartRunContext,
        chunk: Blob,
        partNumber: number,
        maxRetries: number = 5
    ) {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            if (run.signal.aborted) throw codedError('Upload aborted', 'ABORTED');
            try {
                const presignedUrl = await this.getPresignedPartUrl(run, partNumber);

                // Global cap across all files — hold a slot only while the PUT is on the wire
                const release = await this.partSlots.acquire();
                let uploadResponse: Response;
                try {
                    if (run.signal.aborted) throw codedError('Upload aborted', 'ABORTED');
                    // Stalled connections must not hold one of the global PUT slots
                    // forever (six of them would freeze every upload in the tab).
                    // Budget: 3 min, or 50 KB/s for big parts, whichever is longer.
                    const timeoutMs = Math.max(180_000, Math.ceil(chunk.size / 50_000) * 1000);
                    const timed = withTimeout(run.signal, timeoutMs);
                    try {
                        uploadResponse = await fetch(presignedUrl, {
                            method: "PUT",
                            body: chunk,
                            headers: { "Content-Type": run.fileType },
                            signal: timed.signal,
                        });
                    } finally {
                        timed.clear();
                    }
                } finally {
                    release();
                }

                if (uploadResponse.status === 503) {
                    const retryAfter = parseInt(uploadResponse.headers.get('Retry-After') || '0') || 0;
                    const backoffMs = Math.max(retryAfter * 1000, Math.pow(2, attempt) * 1000 + Math.random() * 1000);
                    console.warn(`⚠️ S3 503 on part ${partNumber}, attempt ${attempt + 1}/${maxRetries}. Retrying in ${Math.round(backoffMs)}ms...`);
                    await this.sleep(backoffMs, run.signal);
                    continue;
                }

                if (uploadResponse.status >= 500 && uploadResponse.status <= 599) {
                    const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                    console.warn(`⚠️ S3 ${uploadResponse.status} on part ${partNumber}, attempt ${attempt + 1}/${maxRetries}. Retrying in ${Math.round(backoffMs)}ms...`);
                    await this.sleep(backoffMs, run.signal);
                    continue;
                }

                // 404 NoSuchUpload — R2 aborts unfinished multipart uploads after ~7 days
                if (uploadResponse.status === 404) {
                    throw codedError(SESSION_EXPIRED_MESSAGE, 'SESSION_EXPIRED');
                }

                // 403 — presigned URL expired (e.g. resuming hours later). Drop it so the
                // retry below fetches a fresh one; counts as a normal retry attempt.
                if (uploadResponse.status === 403) {
                    this.partUrlCache.get(run.id)?.delete(partNumber);
                    throw new Error(`S3 Error (403) — presigned URL rejected, refreshing`);
                }

                if (!uploadResponse.ok) {
                    const errText = await uploadResponse.text().catch(() => '');
                    if (errText.includes('NoSuchUpload')) {
                        throw codedError(SESSION_EXPIRED_MESSAGE, 'SESSION_EXPIRED');
                    }
                    throw new Error(`S3 Error (${uploadResponse.status})`);
                }

                const etag = uploadResponse.headers.get("ETag");
                if (!etag) throw new Error("No ETag from S3");

                return {
                    ETag: etag.replace(/"/g, ""),
                    PartNumber: partNumber,
                };
            } catch (err: any) {
                if (run.signal.aborted) throw codedError('Upload aborted', 'ABORTED');
                if ((err as CodedError)?.code === 'SESSION_EXPIRED') throw err;
                lastError = err;
                const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.warn(`⚠️ Upload error on part ${partNumber}, attempt ${attempt + 1}/${maxRetries}: ${err.message}. Retrying in ${Math.round(backoffMs)}ms...`);
                await this.sleep(backoffMs, run.signal);
            }
        }

        throw lastError || new Error(`S3 upload failed after ${maxRetries} attempts for part ${partNumber}`);
    }

    // Resolves after `ms`, or early if `signal` aborts
    private sleep(ms: number, signal?: AbortSignal): Promise<void> {
        return new Promise(resolve => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            const done = () => {
                if (timer !== undefined) clearTimeout(timer);
                signal?.removeEventListener('abort', done);
                resolve();
            };
            timer = setTimeout(done, ms);
            signal?.addEventListener('abort', done, { once: true });
        });
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

    // ─── FIFO QUEUE: Enqueue a file for upload ───
    // Files start in FIFO order; up to MAX_CONCURRENT_FILES upload at once.
    // Returns the upload ID as soon as the file starts uploading (not after completion)
    // onIdReady callback fires immediately when the upload ID is available, before any event
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

            this.pumpQueue();
        });
    }

    private pumpQueue() {
        while (this.activeFileSlots < MAX_CONCURRENT_FILES && this.uploadQueue.length > 0) {
            const entry = this.uploadQueue.shift()!;
            this.activeFileSlots++;
            console.log(`🚀 Processing: ${entry.file.name} (in flight: ${this.activeFileSlots}, remaining in queue: ${this.uploadQueue.length})`);

            this.runQueueEntry(entry).finally(() => {
                this.activeFileSlots--;
                if (this.activeFileSlots === 0 && this.uploadQueue.length === 0) {
                    console.log("✅ Upload queue empty");
                }
                this.pumpQueue();
            });
        }
    }

    // Holds one file slot until exactly this entry's upload has finished
    // (completed, failed, paused or cancelled).
    private async runQueueEntry(entry: QueueEntry) {
        try {
            if (entry.resumeId) {
                // Paused or cancelled while waiting for a slot — nothing to do
                const current = await uploadStateManager.getUploadState(entry.resumeId);
                if (!current || current.status !== 'queued') return;
            }

            // Tell prepareUpload this resume came off the queue, so a pause clicked
            // while it was being set up (codec sniffing etc.) is respected.
            if (entry.resumeId) this.expectQueued.add(entry.resumeId);
            let prepared: PreparedUpload;
            try {
                prepared = await this.prepareUpload(
                    entry.file,
                    entry.taskData,
                    entry.subfolder,
                    entry.resumeId,
                    entry.folderType,
                    entry.relativePath
                );
            } finally {
                if (entry.resumeId) this.expectQueued.delete(entry.resumeId);
            }

            // Resolve the entry IMMEDIATELY so the caller gets the ID (and onIdReady
            // subscribes) before launch() emits 'started'
            entry.resolve(prepared.id);

            await prepared.launch();
        } catch (err: any) {
            if ((err as CodedError)?.code === 'PAUSED_BEFORE_START') return; // paused/cancelled while queued
            console.error(`❌ Queue processing failed for ${entry.file.name}:`, err);
            if (entry.resumeId) {
                await uploadStateManager.markAsFailed(entry.resumeId, err.message);
                const failed = await uploadStateManager.getUploadState(entry.resumeId);
                if (failed) this.emit(entry.resumeId, 'failed', failed);
            }
            entry.reject(err);
        }
    }

    getQueueSize(): number {
        return this.uploadQueue.length;
    }

    // Direct start — bypasses the file queue (still shares the global part-PUT cap).
    async startUpload(file: File, taskData: any, subfolder: string, resumeId?: string, folderType: string = "outputs", relativePath?: string) {
        const { id, launch } = await this.prepareUpload(file, taskData, subfolder, resumeId, folderType, relativePath);

        // Defer emit and upload start to the next task so that callers can
        // subscribe to events (after awaiting the returned id) before they fire
        setTimeout(() => { launch(); }, 0);

        return id;
    }

    // Initiates (or reloads, for resumeId) the upload state; the returned launch()
    // actually emits 'started' and moves the bytes.
    private async prepareUpload(file: File, taskData: any, subfolder: string, resumeId?: string, folderType: string = "outputs", relativePath?: string): Promise<PreparedUpload> {
        let state: UploadState;

        // file.type is often '' for .mov and other files dropped via folder picker
        // Infer MIME from extension as fallback
        const resolvedFileType = file.type || inferMimeType(file.name);

        const isVideo = resolvedFileType.startsWith('video/') ||
            ['mp4', 'mkv', 'mov', 'avi', 'webm'].some(ext => file.name.toLowerCase().endsWith('.' + ext));

        let codec: string | null = null;
        if (isVideo) {
            console.log("🎥 Identifying video codec for:", file.name);
            codec = await this.detectCodec(file);
        }

        const controller = new AbortController();

        if (resumeId) {
            const existing = await uploadStateManager.getUploadState(resumeId);
            if (!existing) throw new Error("Upload state not found");
            if (existing.uploadId === 'single-put') {
                throw new Error("Single-PUT uploads can't be resumed in place — use resumeUpload()");
            }
            // Clear the previous error / stale speed so the panel shows a fresh upload
            const mustBeQueued = this.expectQueued.has(resumeId);
            let pausedMeanwhile = false;
            const resumed = await uploadStateManager.updateUploadState(resumeId, (s) => {
                if (mustBeQueued && s.status !== 'queued') {
                    pausedMeanwhile = true; // user paused/cancelled while this resume waited
                    return;
                }
                s.status = 'uploading';
                s.error = undefined;
                s.speed = 0;
                s.estimatedTimeLeft = 0;
            });
            if (!resumed) throw new Error("Upload state not found");
            if (pausedMeanwhile) throw codedError('Paused before start', 'PAUSED_BEFORE_START');
            state = resumed;
            console.log(`▶️ Resuming ${state.fileName} (${state.completedChunks.length}/${state.totalChunks} parts done)`);
        } else {
            const id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const initResponse = await fetch("/api/upload/initiate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: resolvedFileType,
                    fileSize: file.size,
                    taskId: taskData?.id || "drive-upload",
                    clientId: taskData?.clientId || "unknown",
                    folderType,
                    taskTitle: taskData?.title || "",
                    subfolder,
                    relativePath,
                }),
            });

            if (!initResponse.ok) {
                const errData = await initResponse.json().catch(() => ({}));
                const code = errData.error || errData.message || initResponse.statusText;
                throw new Error(`Failed to initiate upload for "${file.name}": ${code}`);
            }
            const initData = await initResponse.json();

            // ── Small file: single PUT directly to R2 ────────────────────────
            if (initData.singlePut) {
                const singleState: UploadState = {
                    id,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: resolvedFileType,
                    taskId: taskData?.id || 'drive-upload',
                    clientId: taskData?.clientId || 'unknown',
                    folderType,
                    uploadId: 'single-put',
                    key: initData.key,
                    uploadedParts: [],
                    uploadedBytes: 0,
                    totalChunks: 1,
                    completedChunks: [],
                    status: 'uploading',
                    startedAt: Date.now(),
                    lastUpdated: Date.now(),
                    subfolder,
                    relativePath,
                    taggedEditorIds: taskData?.taggedEditorIds,
                    batchId: taskData?.batchId,
                    batchTotal: taskData?.batchTotal,
                    replaceFileId: taskData?.replaceFileId,
                    fileLastModified: file.lastModified,
                    taskSnapshot: snapshotTask(taskData),
                };
                await uploadStateManager.saveUploadState(singleState);
                this.activeUploads.set(id, true);
                this.files.set(id, file);
                this.controllers.set(id, controller);

                return {
                    id,
                    launch: () => this.trackLoop(id, (async () => {
                        this.emit(id, 'started', singleState);
                        await this.runSinglePut(file, singleState, initData, codec, controller);
                    })()),
                };
            }

            const chunkSize = chooseChunkSize(file.size);
            state = {
                id,
                fileName: file.name,
                fileSize: file.size,
                fileType: resolvedFileType,
                taskId: taskData?.id || "drive-upload",
                clientId: taskData?.clientId || "unknown",
                folderType,
                uploadId: initData.uploadId,
                key: initData.key,
                uploadedParts: [],
                uploadedBytes: 0,
                totalChunks: Math.ceil(file.size / chunkSize),
                completedChunks: [],
                status: 'uploading',
                startedAt: Date.now(),
                lastUpdated: Date.now(),
                subfolder,
                relativePath,
                taggedEditorIds: taskData?.taggedEditorIds,
                batchId: taskData?.batchId,
                batchTotal: taskData?.batchTotal,
                replaceFileId: taskData?.replaceFileId,
                chunkSize,
                fileLastModified: file.lastModified,
                taskSnapshot: snapshotTask(taskData),
            };

            await uploadStateManager.saveUploadState(state);
        }

        const readyState = state;
        this.activeUploads.set(readyState.id, true);
        this.files.set(readyState.id, file);
        this.controllers.set(readyState.id, controller);

        return {
            id: readyState.id,
            launch: () => this.trackLoop(readyState.id, (async () => {
                this.emit(readyState.id, 'started', readyState);
                await this.runUploadLoop(file, readyState, codec, controller);
            })()),
        };
    }

    private trackLoop(id: string, run: Promise<void>): Promise<void> {
        this.runningLoops.set(id, run);
        return run.finally(() => {
            if (this.runningLoops.get(id) === run) this.runningLoops.delete(id);
        });
    }

    private async runSinglePut(file: File, singleState: UploadState, initData: any, codec: string | null, controller: AbortController) {
        const id = singleState.id;
        try {
            // Takes one slot of the global PUT cap for the duration of the PUT
            const release = await this.partSlots.acquire();
            let putRes: Response;
            try {
                if (controller.signal.aborted) throw codedError('Upload aborted', 'ABORTED');
                putRes = await fetch(initData.uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': singleState.fileType },
                    signal: controller.signal,
                });
            } finally {
                release();
            }
            if (!putRes.ok) throw new Error(`Single PUT failed: ${putRes.status}`);

            // ── Notify the main app that the file is in R2 ──────────────────
            // /api/upload/complete creates the DB record, triggers Drive mirror,
            // Slack notification, audit log, and storage update — identical to
            // what happens after a multipart upload. Without this call, the file
            // lands in R2 but is invisible to the rest of the system.
            const completeRes = await fetch('/api/upload/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: initData.key,
                    uploadId: 'single-put',   // sentinel — complete route ignores this for singlePut
                    singlePut: true,
                    fileUrl: initData.fileUrl,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: singleState.fileType,
                    taskId: singleState.taskId,
                    subfolder: singleState.subfolder || 'main',
                    codec,
                    taggedEditorIds: singleState.taggedEditorIds,
                    batchId: singleState.batchId,
                    batchTotal: singleState.batchTotal,
                    replaceFileId: singleState.replaceFileId,
                }),
                signal: AbortSignal.timeout(30_000),
            });
            if (!completeRes.ok) {
                const errText = await completeRes.text().catch(() => completeRes.statusText);
                console.warn(`⚠️ Single-PUT complete notify failed (${completeRes.status}): ${errText}`);
                // Not fatal — file is already in R2; DB record creation failed but we
                // don't want to show an error to the user for a successful upload.
            } else {
                console.log(`✅ Single-PUT complete notified for: ${file.name}`);
            }

            singleState.uploadedBytes = file.size;
            singleState.completedChunks = [1];
            await uploadStateManager.markAsCompleted(id);
            this.files.delete(id);
            this.emit(id, 'completed', { ...singleState, status: 'completed' });
        } catch (err: any) {
            // Paused or cancelled mid-PUT — not a failure
            const latest = await uploadStateManager.getUploadState(id).catch(() => undefined);
            if (!latest || latest.status === 'paused') return;
            await uploadStateManager.markAsFailed(id, err.message);
            this.emit(id, 'failed', { ...singleState, status: 'failed', error: err.message });
        } finally {
            this.activeUploads.delete(id);
            if (this.controllers.get(id) === controller) this.controllers.delete(id);
        }
    }

    private async runUploadLoop(file: File, initialState: UploadState, codecProps: string | null | undefined, controller: AbortController) {
        const { id, key, uploadId: s3UploadId } = initialState;
        const currentState: UploadState = {
            ...initialState,
            uploadedParts: [...initialState.uploadedParts],
            completedChunks: [...initialState.completedChunks],
        };
        // States saved before adaptive sizing have no chunkSize — they used CHUNK_SIZE
        const chunkSize = currentState.chunkSize ?? CHUNK_SIZE;
        let codec = codecProps;

        // Speed tracking: wall-clock throughput over the last few completed parts.
        // (Per-part durations would be wrong now that parts run in parallel and
        // wait for shared PUT slots.)
        const speedSamples: Array<{ at: number; bytes: number }> = [];
        let windowStartAt = Date.now();

        if (!codec && currentState.fileType.startsWith('video/')) {
            codec = await this.detectCodec(file);
        }

        const run: PartRunContext = {
            id,
            key,
            uploadId: s3UploadId,
            fileType: currentState.fileType,
            totalChunks: currentState.totalChunks,
            completedChunks: currentState.completedChunks,
            signal: controller.signal,
        };

        try {
            const chunks: Array<{ chunk: Blob; partNumber: number }> = [];
            for (let i = 0; i < currentState.totalChunks; i++) {
                const partNumber = i + 1;
                if (currentState.completedChunks.includes(partNumber)) continue;

                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                chunks.push({ chunk: file.slice(start, end), partNumber });
            }

            const queue = [...chunks];
            let firstError: any = null;
            const workers = Array(Math.min(PARALLEL_UPLOADS, chunks.length))
                .fill(null)
                .map(async () => {
                    while (queue.length > 0) {
                        if (controller.signal.aborted) return;
                        const latestStatus = await uploadStateManager.getUploadState(id);
                        if (!latestStatus || latestStatus.status !== 'uploading') return;

                        const item = queue.shift();
                        if (!item) break;

                        try {
                            const result = await this.uploadChunk(run, item.chunk, item.partNumber);

                            // Track speed sample
                            const now = Date.now();
                            speedSamples.push({ at: now, bytes: item.chunk.size });
                            if (speedSamples.length > SPEED_WINDOW_SIZE) {
                                windowStartAt = speedSamples.shift()!.at;
                            }

                            // Calculate rolling average speed
                            const windowBytes = speedSamples.reduce((s, x) => s + x.bytes, 0);
                            const windowMs = now - windowStartAt;
                            const speed = windowMs > 0 ? (windowBytes / windowMs) * 1000 : 0;
                            const remaining = currentState.fileSize - (currentState.uploadedBytes + item.chunk.size);
                            const eta = speed > 0 ? remaining / speed : 0;

                            // Update master copy
                            currentState.uploadedParts.push(result);
                            currentState.completedChunks.push(item.partNumber);
                            currentState.uploadedBytes += item.chunk.size;
                            currentState.lastUpdated = Date.now();
                            currentState.speed = speed;
                            currentState.estimatedTimeLeft = eta;

                            // Save and emit (no progress event once paused/cancelled — it would
                            // flip the panel back to "Uploading")
                            await uploadStateManager.updateProgress(id, currentState.uploadedBytes, currentState.completedChunks, currentState.uploadedParts);
                            if (!controller.signal.aborted) this.emit(id, 'progress', { ...currentState });
                        } catch (err: any) {
                            if ((err as CodedError)?.code !== 'ABORTED') {
                                console.error(`Worker error for part ${item.partNumber}:`, err);
                            }
                            throw err;
                        }
                    }
                })
                .map(worker => worker.catch(err => {
                    // First failure stops the sibling workers too
                    if (!firstError) {
                        firstError = err;
                        controller.abort();
                    }
                }));

            await Promise.all(workers);
            if (firstError) throw firstError;

            const finalCheck = await uploadStateManager.getUploadState(id);
            if (!finalCheck || finalCheck.status !== 'uploading') return;

            if (currentState.completedChunks.length < currentState.totalChunks) {
                // Some chunks didn't complete — treat as failure so queue doesn't hang
                const missing = currentState.totalChunks - currentState.completedChunks.length;
                const errMsg = `Upload incomplete: ${missing} of ${currentState.totalChunks} chunks failed`;
                console.error(`❌ ${errMsg} for ${currentState.fileName}`);
                throw new Error(errMsg);
            }

            // Complete
            currentState.uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber);

            // Stagger complete calls — when many files finish at the same time (folder upload),
            // this spreads the R2 CompleteMultipart requests out to avoid rate limiting.
            const staggerMs = Math.random() * 3000;
            console.log(`⏳ Staggering complete by ${Math.round(staggerMs)}ms to avoid R2 overload`);
            await this.sleep(staggerMs, controller.signal);
            if (controller.signal.aborted) throw codedError('Upload aborted', 'ABORTED');

            // Retry complete up to 5 times — this is the most critical step
            let completeResponse: Response | null = null;
            let sessionExpired = false;
            for (let attempt = 0; attempt < 5; attempt++) {
                // Cancelled (state deleted) or paused while we were waiting — don't finalize.
                const stillWanted = await uploadStateManager.getUploadState(id).catch(() => undefined);
                if (controller.signal.aborted || !stillWanted || stillWanted.status !== 'uploading') {
                    throw codedError('Upload aborted', 'ABORTED');
                }
                try {
                    completeResponse = await fetch("/api/upload/complete", {
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
                            codec: codec,
                            taggedEditorIds: currentState.taggedEditorIds,
                            batchId: currentState.batchId,
                            batchTotal: currentState.batchTotal,
                            replaceFileId: currentState.replaceFileId,
                        }),
                        signal: AbortSignal.timeout(90_000), // 90s — R2 complete can be slow for large files
                    });
                    if (completeResponse.ok) break; // success — exit retry loop
                    const errText = await completeResponse.text().catch(() => completeResponse!.statusText);
                    console.warn(`⚠️ Complete attempt ${attempt + 1}/5 failed (${completeResponse.status}): ${errText}`);
                    if (errText.includes('NoSuchUpload')) {
                        sessionExpired = true; // retrying can't help — the multipart session is gone
                        break;
                    }
                } catch (err: any) {
                    console.warn(`⚠️ Complete attempt ${attempt + 1}/5 error: ${err.message}`);
                    completeResponse = null;
                }
                if (attempt < 4) {
                    const backoffMs = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s, 16s
                    console.log(`🔄 Retrying complete in ${backoffMs}ms...`);
                    await this.sleep(backoffMs, controller.signal);
                }
            }

            if (sessionExpired) throw codedError(SESSION_EXPIRED_MESSAGE, 'SESSION_EXPIRED');
            if (!completeResponse?.ok) throw new Error("Failed to complete upload after 5 attempts");

            await uploadStateManager.markAsCompleted(id);
            this.files.delete(id);
            this.emit(id, 'completed', { ...currentState, status: 'completed', speed: 0, estimatedTimeLeft: 0 });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('task-updated', {
                    detail: { taskId: currentState.taskId }
                }));
            }
        } catch (err: any) {
            // Paused or cancelled while parts were in flight — the abort isn't a failure
            const latest = await uploadStateManager.getUploadState(id).catch(() => undefined);
            if (!latest || latest.status === 'paused') {
                console.log(`⏸️ Upload loop stopped for ${currentState.fileName} (${latest ? 'paused' : 'cancelled'})`);
                return;
            }

            const message = (err as CodedError)?.code === 'SESSION_EXPIRED' ? SESSION_EXPIRED_MESSAGE : err.message;
            console.error("Background upload loop failed:", err);
            await uploadStateManager.markAsFailed(id, message);
            this.emit(id, 'failed', { ...currentState, status: 'failed', error: message, speed: 0, estimatedTimeLeft: 0 });
        } finally {
            this.activeUploads.delete(id);
            if (this.controllers.get(id) === controller) this.controllers.delete(id);
            // Presigned URLs may be stale by the next resume — fetch fresh ones then
            this.partUrlCache.delete(id);
        }
    }

    // Resume a paused/failed upload. Uses `file` if given, else the File still in
    // memory from this session; throws Error('NEEDS_FILE') if neither exists and
    // Error('FILE_MISMATCH') if the file isn't the one originally picked.
    // Multipart: re-queued (FIFO, shares the file slots and global PUT cap) and
    // continues from the saved completedChunks/ETags under the same id.
    // Single-PUT or expired session: re-initiated from scratch under a NEW id —
    // `onRestarted(newId)` fires as soon as that id exists (before its events).
    async resumeUpload(id: string, file?: File, onRestarted?: (newId: string) => void): Promise<void> {
        // Already waiting for a slot, or a resume call (e.g. double click) is mid-flight
        if (this.uploadQueue.some(e => e.resumeId === id) || this.resuming.has(id)) return;
        this.resuming.add(id);
        try {
            await this.doResume(id, file, onRestarted);
        } finally {
            this.resuming.delete(id);
        }
    }

    private async doResume(id: string, file?: File, onRestarted?: (newId: string) => void): Promise<void> {

        // After a pause the loop may still be winding down (aborting in-flight PUTs).
        // Wait for it so two loops never run for the same upload.
        const running = this.runningLoops.get(id);
        if (running) {
            const live = await uploadStateManager.getUploadState(id);
            if (live?.status === 'uploading') return; // not paused — already running
            await running.catch(() => undefined);
        }
        if (this.activeUploads.has(id)) return;

        const state = await uploadStateManager.getUploadState(id);
        if (!state) throw new Error("Upload state not found");
        if (state.status === 'completed' || state.status === 'queued') return;

        const source = file || this.files.get(id);
        if (!source) throw new Error('NEEDS_FILE');
        if (
            source.name !== state.fileName ||
            source.size !== state.fileSize ||
            (state.fileLastModified != null && source.lastModified !== state.fileLastModified)
        ) {
            throw new Error('FILE_MISMATCH');
        }

        // Nothing to resume for a single PUT; an expired multipart session can't take
        // more parts. Re-initiate from scratch with the original task data.
        if (state.uploadId === 'single-put' || state.error === SESSION_EXPIRED_MESSAGE) {
            const taskData: UploadTaskSnapshot = state.taskSnapshot ?? {
                id: state.taskId,
                clientId: state.clientId,
                taggedEditorIds: state.taggedEditorIds,
                batchId: state.batchId,
                batchTotal: state.batchTotal,
                replaceFileId: state.replaceFileId,
            };
            console.log(`🔁 Restarting ${state.fileName} from scratch`);
            await uploadStateManager.deleteUploadState(id);
            this.files.delete(id);
            this.enqueueUpload(source, taskData, state.subfolder || '', state.folderType, state.relativePath, onRestarted)
                .catch(async (err: any) => {
                    // Couldn't even re-initiate — put the old entry back as failed so
                    // the panel shows the error and Retry stays available
                    console.error(`❌ Restart failed for ${state.fileName}:`, err);
                    const failedState: UploadState = { ...state, status: 'failed', error: err.message };
                    await uploadStateManager.saveUploadState(failedState).catch(() => undefined);
                    this.files.set(id, source);
                    this.emit(id, 'failed', failedState);
                });
            return;
        }

        this.files.set(id, source);
        const queuedState = await uploadStateManager.updateUploadState(id, (s) => {
            s.status = 'queued';
            s.error = undefined;
            s.speed = 0;
            s.estimatedTimeLeft = 0;
        });
        if (queuedState) this.emit(id, 'queued', queuedState);

        this.uploadQueue.push({
            file: source,
            taskData: null,
            subfolder: state.subfolder || '',
            folderType: state.folderType,
            relativePath: state.relativePath,
            resumeId: id,
            resolve: () => { /* same id — caller is already subscribed */ },
            reject: () => { /* runQueueEntry marks the upload failed */ },
        });
        console.log(`📥 Queued resume: ${state.fileName} (queue size: ${this.uploadQueue.length})`);
        this.pumpQueue();
    }

    async pauseUpload(id: string) {
        await uploadStateManager.pauseUpload(id);
        // Drop a resume that's still waiting for a slot
        this.uploadQueue = this.uploadQueue.filter(e => e.resumeId !== id);
        // Stop in-flight PUTs now (workers also check status before every chunk);
        // aborted parts are simply re-sent on resume.
        this.controllers.get(id)?.abort();
        const state = await uploadStateManager.getUploadState(id);
        if (state) this.emit(id, 'paused', state);
    }

    async cancelUpload(id: string) {
        const state = await uploadStateManager.getUploadState(id);
        this.uploadQueue = this.uploadQueue.filter(e => e.resumeId !== id);

        // Delete state BEFORE aborting so the winding-down loop sees "cancelled", not "failed"
        await uploadStateManager.deleteUploadState(id);
        this.controllers.get(id)?.abort();
        this.activeUploads.delete(id);
        this.files.delete(id);

        if (state) {
            try {
                await fetch("/api/upload/abort", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: state.key, uploadId: state.uploadId }),
                });
            } catch (err: any) {
                console.warn(`⚠️ Abort request failed for ${state.fileName}: ${err?.message}`);
            }
        }
        // The upload's queue slot frees itself once its loop sees the state is gone
    }
}

export const uploadService = new UploadService();
