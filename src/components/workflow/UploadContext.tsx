// components/workflow/UploadContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { uploadService } from '@/lib/upload-service';
import { uploadStateManager, UploadState } from '@/lib/upload-state-manager';

interface UploadContextType {
    activeUploads: UploadState[];
    startUpload: (file: File, taskData: any, subfolder: string, resumeId?: string, folderType?: string) => Promise<string>;
    enqueueUpload: (file: File, taskData: any, subfolder: string, folderType?: string, relativePath?: string) => Promise<string>;
    pauseUpload: (id: string) => Promise<void>;
    cancelUpload: (id: string) => Promise<void>;
    clearCompleted: () => void;
    getUploadState: (id: string) => UploadState | undefined;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
    const [activeUploads, setActiveUploads] = useState<UploadState[]>([]);

    // Load active uploads on mount — mark stale "uploading" as "paused"
    useEffect(() => {
        const loadActive = async () => {
            const active = await uploadStateManager.getAllActiveUploads();
            
            // Any upload marked "uploading" on mount is a zombie — no JS worker is running
            for (const upload of active) {
                if (upload.status === 'uploading') {
                    await uploadStateManager.pauseUpload(upload.id);
                    upload.status = 'paused';
                }
            }

            // Also load completed uploads so they stay visible
            const allUploads = await uploadStateManager.getAllUploads();
            const completed = allUploads.filter(u => u.status === 'completed');
            
            setActiveUploads([...active, ...completed]);
        };
        loadActive();
    }, []);

    const updateUploadInState = useCallback((state: UploadState) => {
        setActiveUploads(prev => {
            const exists = prev.find(u => u.id === state.id);
            if (exists) {
                return prev.map(u => u.id === state.id ? state : u);
            }
            return [...prev, state];
        });
    }, []);

    const subscribeToUpload = useCallback((id: string) => {
        const listener = (state: UploadState) => {
            updateUploadInState(state);
            // NO auto-removal — completed uploads stay visible until user clears them
        };

        uploadService.on(id, 'started', listener);
        uploadService.on(id, 'progress', listener);
        uploadService.on(id, 'completed', listener);
        uploadService.on(id, 'failed', listener);
        uploadService.on(id, 'paused', listener);

        return listener;
    }, [updateUploadInState]);

    const handleStart = async (file: File, taskData: any, subfolder: string, resumeId?: string, folderType?: string) => {
        const id = await uploadService.startUpload(file, taskData, subfolder, resumeId, folderType);

        // Immediately fetch state from IndexedDB and add to React state
        const initialState = await uploadStateManager.getUploadState(id);
        if (initialState) {
            updateUploadInState(initialState);
        }

        subscribeToUpload(id);
        return id;
    };

    // FIFO queue — enqueue files for one-at-a-time processing
    const handleEnqueue = async (file: File, taskData: any, subfolder: string, folderType?: string, relativePath?: string) => {
        // We need to subscribe to events BEFORE the upload starts emitting them.
        // Use the onIdReady callback to subscribe as soon as the ID is available,
        // before runUploadLoop starts firing progress/completed events.
        let earlyId: string | null = null;

        const idPromise = uploadService.enqueueUpload(
            file,
            taskData,
            subfolder,
            folderType || 'outputs',
            relativePath,
            // This callback fires synchronously when the upload ID is created,
            // BEFORE runUploadLoop starts emitting events
            (id: string) => {
                earlyId = id;
                subscribeToUpload(id);

                // Immediately fetch state from IndexedDB and add to React state
                uploadStateManager.getUploadState(id).then(initialState => {
                    if (initialState) {
                        updateUploadInState(initialState);
                    }
                });
            }
        );

        const id = await idPromise;

        // If onIdReady didn't fire (shouldn't happen), subscribe as fallback
        if (!earlyId) {
            const initialState = await uploadStateManager.getUploadState(id);
            if (initialState) {
                updateUploadInState(initialState);
            }
            subscribeToUpload(id);
        }

        return id;
    };

    const handlePause = async (id: string) => {
        await uploadService.pauseUpload(id);
    };

    const handleCancel = async (id: string) => {
        await uploadService.cancelUpload(id);
        setActiveUploads(prev => prev.filter(u => u.id !== id));
    };

    const handleClearCompleted = () => {
        setActiveUploads(prev => prev.filter(u => u.status !== 'completed'));
        uploadStateManager.clearCompleted().catch(console.error);
    };

    return (
        <UploadContext.Provider value={{
            activeUploads,
            startUpload: handleStart,
            enqueueUpload: handleEnqueue,
            pauseUpload: handlePause,
            cancelUpload: handleCancel,
            clearCompleted: handleClearCompleted,
            getUploadState: (id) => activeUploads.find(u => u.id === id)
        }}>
            {children}
        </UploadContext.Provider>
    );
}

export function useUploads() {
    const context = useContext(UploadContext);
    if (context === undefined) {
        throw new Error('useUploads must be used within an UploadProvider');
    }
    return context;
}