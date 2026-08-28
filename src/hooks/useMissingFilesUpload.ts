// src/hooks/useMissingFilesUpload.ts
//
// Uploads a batch of local files into a Files & Drive (R2) folder, used by
// File Verification's "Upload missing files" action.
//
// Reuses the existing chunked-upload engine (uploadService.startUpload) —
// same multipart/presigned-PUT flow, retry-per-chunk, and DB/Slack/Drive-mirror
// wiring as every other drive upload — but bypasses uploadService's global
// FIFO queue (which processes one file at a time) so we can run a small pool
// of files in parallel instead.
//
// Note: comparison in FileVerification is by file name only (flat, ignoring
// subfolder structure on both sides), so uploads here land directly in the
// root of the selected remote folder rather than recreating local subfolder
// paths — consistent with how the diff already treats folders.

import { useCallback, useRef, useState } from "react";
import { uploadService } from "@/lib/upload-service";
import type { UploadState } from "@/lib/upload-state-manager";

const MAX_CONCURRENT_UPLOADS = 4;

export type MissingFileStatus = "pending" | "uploading" | "completed" | "failed";

export interface MissingFileItem {
  key: string; // normalized file name — stable id for this batch
  file: File;
  name: string;
  status: MissingFileStatus;
  progress: number; // 0-100
  error?: string;
  uploadServiceId?: string;
}

interface StartBatchArgs {
  files: { key: string; file: File }[];
  clientId: string;
  targetFolderPath: string; // selectedRemoteFolder.path — upload destination
  onBatchSettled?: () => void; // fires once every item is completed or failed
}

export function useMissingFilesUpload() {
  const [items, setItems] = useState<Record<string, MissingFileItem>>({});
  const activeCountRef = useRef(0);
  const queueRef = useRef<string[]>([]);
  const argsRef = useRef<StartBatchArgs | null>(null);
  const settledCountRef = useRef(0);
  const totalCountRef = useRef(0);

  const updateItem = useCallback((key: string, patch: Partial<MissingFileItem>) => {
    setItems((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      return { ...prev, [key]: { ...existing, ...patch } };
    });
  }, []);

  const runOne = useCallback((key: string) => {
    const args = argsRef.current;
    if (!args) return;
    const entry = args.files.find((f) => f.key === key);
    if (!entry) return;

    activeCountRef.current += 1;
    updateItem(key, { status: "uploading", progress: 0, error: undefined });

    const onUpdate = (state: UploadState) => {
      const pct =
        state.fileSize > 0 ? Math.min(100, Math.round((state.uploadedBytes / state.fileSize) * 100)) : 0;
      updateItem(key, { progress: pct });
    };
    const onDone = (state: UploadState) => {
      updateItem(key, { status: "completed", progress: 100 });
      settle();
    };
    const onFail = (state: UploadState) => {
      updateItem(key, { status: "failed", error: state.error || "Upload failed" });
      settle();
    };

    const settle = () => {
      activeCountRef.current -= 1;
      settledCountRef.current += 1;
      pump();
      if (settledCountRef.current >= totalCountRef.current) {
        args.onBatchSettled?.();
      }
    };

    uploadService
      .startUpload(
        entry.file,
        { id: "drive-upload", clientId: args.clientId },
        args.targetFolderPath,
        undefined,
        "drive",
        undefined // relativePath — intentionally omitted, see file header note
      )
      .then((id) => {
        updateItem(key, { uploadServiceId: id });
        uploadService.on(id, "progress", onUpdate);
        uploadService.on(id, "completed", onDone);
        uploadService.on(id, "failed", onFail);
      })
      .catch((err: any) => {
        updateItem(key, { status: "failed", error: err?.message || "Failed to start upload" });
        settle();
      });
  }, [updateItem]);

  const pump = useCallback(() => {
    while (activeCountRef.current < MAX_CONCURRENT_UPLOADS && queueRef.current.length > 0) {
      const nextKey = queueRef.current.shift()!;
      runOne(nextKey);
    }
  }, [runOne]);

  const startBatch = useCallback(
    (args: StartBatchArgs) => {
      argsRef.current = args;
      settledCountRef.current = 0;
      totalCountRef.current = args.files.length;
      queueRef.current = args.files.map((f) => f.key);
      activeCountRef.current = 0;

      const initial: Record<string, MissingFileItem> = {};
      for (const f of args.files) {
        initial[f.key] = {
          key: f.key,
          file: f.file,
          name: f.file.name,
          status: "pending",
          progress: 0,
        };
      }
      setItems(initial);
      pump();
    },
    [pump]
  );

  const retryOne = useCallback(
    (key: string) => {
      if (!argsRef.current) return;
      totalCountRef.current += 0; // no-op, batch total unchanged
      settledCountRef.current = Math.max(0, settledCountRef.current - 1);
      queueRef.current.push(key);
      pump();
    },
    [pump]
  );

  const reset = useCallback(() => {
    setItems({});
    argsRef.current = null;
    queueRef.current = [];
    activeCountRef.current = 0;
    settledCountRef.current = 0;
    totalCountRef.current = 0;
  }, []);

  const list = Object.values(items).sort((a, b) => a.name.localeCompare(b.name));
  const overall = {
    total: list.length,
    completed: list.filter((i) => i.status === "completed").length,
    failed: list.filter((i) => i.status === "failed").length,
    uploading: list.filter((i) => i.status === "uploading").length,
  };

  return { items: list, overall, startBatch, retryOne, reset };
}