// components/workflow/UploadContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { uploadService } from '@/lib/upload-service';
import { uploadStateManager, UploadState } from '@/lib/upload-state-manager';

interface UploadContextType {
    activeUploads: UploadState[];
    startUpload: (file: File, taskData: any, subfolder: string, resumeId?: string, folderType?: string) => Promise<string>;
    pauseUpload: (id: string) => Promise<void>;
    cancelUpload: (id: string) => Promise<void>;
    getUploadState: (id: string) => UploadState | undefined;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
    const [activeUploads, setActiveUploads] = useState<UploadState[]>([]);

    // Load active uploads on mount
    useEffect(() => {
        const loadActive = async () => {
            const active = await uploadStateManager.getAllActiveUploads();
            setActiveUploads(active);
        };
        loadActive();
    }, []);

    const updateUploadInState = useCallback((state: UploadState) => {
        setActiveUploads(prev => {
            const exists = prev.find(u => u.id === state.id);
            if (state.status === 'completed' || state.status === 'failed') {
                // We might want to keep failed ones for a bit, but completed can be removed or moved to history
                // For now, let's keep them so the user sees the success/fail message
                if (exists) {
                    return prev.map(u => u.id === state.id ? state : u);
                }
                return [...prev, state];
            }

            if (exists) {
                return prev.map(u => u.id === state.id ? state : u);
            }
            return [...prev, state];
        });
    }, []);

    const handleStart = async (file: File, taskData: any, subfolder: string, resumeId?: string, folderType?: string) => {
        const id = await uploadService.startUpload(file, taskData, subfolder, resumeId, folderType);

        // Subscribe to events
        const listener = (state: UploadState) => {
            updateUploadInState(state);
            if (state.status === 'completed' || state.status === 'failed') {
                // Optional: auto-remove after some time
                setTimeout(() => {
                    setActiveUploads(prev => prev.filter(u => u.id !== state.id));
                    uploadService.off(id, 'progress', listener);
                    uploadService.off(id, 'completed', listener);
                    uploadService.off(id, 'failed', listener);
                }, 10000);
            }
        };

        uploadService.on(id, 'progress', listener);
        uploadService.on(id, 'completed', listener);
        uploadService.on(id, 'failed', listener);
        uploadService.on(id, 'paused', listener);

        return id;
    };

    const handlePause = async (id: string) => {
        await uploadService.pauseUpload(id);
    };

    const handleCancel = async (id: string) => {
        await uploadService.cancelUpload(id);
        setActiveUploads(prev => prev.filter(u => u.id !== id));
    };

    return (
        <UploadContext.Provider value={{
            activeUploads,
            startUpload: handleStart,
            pauseUpload: handlePause,
            cancelUpload: handleCancel,
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
