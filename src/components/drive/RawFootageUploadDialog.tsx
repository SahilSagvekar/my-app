// components/drive/RawFootageUploadDialog.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Folder,
  FolderOpen,
  FileVideo,
  ChevronRight,
  Loader2,
  Calendar,
  Package,
  RefreshCw,
  Users,
} from "lucide-react";
import { uploadStateManager, UploadState } from "@/lib/upload-state-manager";
import { useUploads } from "../workflow/UploadContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Selected file with optional relative path ────────────────────────────────
interface SelectedFile {
  file: File;
  relativePath?: string; // e.g. "sahil/sf/clip1.mp4"
}

// ─── Folder traversal helpers ─────────────────────────────────────────────────
async function getFileFromEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => { entry.file(resolve, reject); });
}

async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  let batch: FileSystemEntry[];
  do {
    batch = await new Promise((resolve, reject) => {
      reader.readEntries(resolve as any, reject);
    });
    entries.push(...batch);
  } while (batch.length > 0);
  return entries;
}

async function traverseEntry(
  entry: FileSystemEntry,
  path: string,
  result: SelectedFile[]
): Promise<void> {
  if (entry.isFile) {
    const file = await getFileFromEntry(entry as FileSystemFileEntry);
    result.push({
      file,
      relativePath: path ? `${path}/${entry.name}` : undefined,
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const entries = await readAllEntries(reader);
    for (const child of entries) {
      await traverseEntry(
        child,
        path ? `${path}/${entry.name}` : entry.name,
        result
      );
    }
  }
}

interface DeliverableType {
  type: string;
  isOneOff: boolean;
  platforms: string[];
  description: string | null;
}

interface AssignedEditor {
  id: number;
  name: string | null;
  email: string;
  slackUserId: string | null;
}

interface RawFootageUploadDialogProps {
  clientId: string;
  companyName: string;
  onUploadComplete: () => void;
  trigger?: React.ReactNode;
  mode?: 'rawFootage' | 'elements';
  role?: string;
}

function getMonthOptions(): { value: string; label: string; isCurrent: boolean }[] {
  const months: { value: string; label: string; isCurrent: boolean }[] = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    const value = `${monthName}-${year}`;
    const label = i === 0 ? `${monthName} ${year} (current)` : `${monthName} ${year}`;
    months.push({ value, label, isCurrent: i === 0 });
  }
  return months;
}

export function RawFootageUploadDialog({
  clientId,
  companyName,
  onUploadComplete,
  trigger,
  mode = 'rawFootage',
  role,
}: RawFootageUploadDialogProps) {
  const isElementsMode = mode === 'elements';
  const isAdminOrManager = role === 'admin' || role === 'manager';
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDeliverable, setSelectedDeliverable] = useState<string>("");
  const [subfolderName, setSubfolderName] = useState<string>("");

  const [deliverables, setDeliverables] = useState<DeliverableType[]>([]);
  const [loadingDeliverables, setLoadingDeliverables] = useState(false);

  const [assignedEditors, setAssignedEditors] = useState<AssignedEditor[]>([]);
  const [loadingEditors, setLoadingEditors] = useState(false);
  const [selectedEditorIds, setSelectedEditorIds] = useState<Set<number>>(new Set());

  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const notifiedUploadsRef = useRef<Set<string>>(new Set());

  const { enqueueUpload, getUploadState } = useUploads();
  const currentUpload = currentUploadId ? getUploadState(currentUploadId) : null;
  const monthOptions = getMonthOptions();

  useEffect(() => {
    if (open && !selectedMonth && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [open, selectedMonth, monthOptions]);

  useEffect(() => {
    if (open && clientId) fetchDeliverables();
  }, [open, clientId]);

  useEffect(() => {
    if (open && clientId && isAdminOrManager && !isElementsMode) fetchAssignedEditors();
    if (!open) {
      // Reset selection each time the dialog closes so a stale pick
      // doesn't silently carry over to the next unrelated upload session
      setSelectedEditorIds(new Set());
    }
  }, [open, clientId, isAdminOrManager, isElementsMode]);

  useEffect(() => {
    if (
      currentUpload?.status === 'completed' &&
      !notifiedUploadsRef.current.has(currentUpload.id)
    ) {
      notifiedUploadsRef.current.add(currentUpload.id);
      onUploadComplete();
      if (selectedFiles.length === 0) {
        setTimeout(() => {
          setOpen(false);
          setCurrentUploadId(null);
          setSubfolderName("");
        }, 2000);
      }
    }
  }, [currentUpload?.status, currentUpload?.id, selectedFiles.length, onUploadComplete]);

  const fetchAssignedEditors = async () => {
    setLoadingEditors(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/assigned-editors`);
      if (!res.ok) throw new Error('Failed to fetch assigned editors');
      const data = await res.json();
      setAssignedEditors(data.editors || []);
    } catch (error) {
      console.error('Error fetching assigned editors:', error);
      // Non-fatal — picker just won't show options, upload still works
      // and falls back to auto-tagging all assigned editors.
    } finally {
      setLoadingEditors(false);
    }
  };

  const toggleEditorSelected = (editorId: number) => {
    setSelectedEditorIds((prev) => {
      const next = new Set(prev);
      if (next.has(editorId)) next.delete(editorId);
      else next.add(editorId);
      return next;
    });
  };

  const fetchDeliverables = async () => {
    setLoadingDeliverables(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/deliverables`);
      if (!res.ok) throw new Error('Failed to fetch deliverables');
      const data = await res.json();
      const types: DeliverableType[] = [];
      const seenTypes = new Set<string>();
      for (const d of (data.deliverables || data.monthlyDeliverables || [])) {
        if (!seenTypes.has(d.type)) {
          seenTypes.add(d.type);
          types.push({
            type: d.type,
            isOneOff: d.isOneOff || false,
            platforms: d.platforms || [],
            description: d.description || null,
          });
        }
      }
      setDeliverables(types);
      if (types.length === 1 && !selectedDeliverable) {
        setSelectedDeliverable(types[0].type);
      }
    } catch (error) {
      console.error('Error fetching deliverables:', error);
      toast.error('Failed to load deliverable types');
    } finally {
      setLoadingDeliverables(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // ─── Drop handler — preserves full folder structure ───────────────────────
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const newFiles: SelectedFile[] = [];

    let hasDirectories = false;
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) { hasDirectories = true; break; }
    }

    if (hasDirectories) {
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) await traverseEntry(entry, '', newFiles);
      }
    } else {
      for (const file of Array.from(e.dataTransfer.files)) {
        newFiles.push({ file });
      }
    }

    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
      const folderCount = newFiles.filter(f => f.relativePath?.includes('/')).length;
      if (folderCount > 0) {
        toast.success(`${newFiles.length} files added (folder structure preserved)`);
      }
    }
  };

  // ─── File picker — no relative path ──────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({ file }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
    if (e.target) e.target.value = '';
  };

  // ─── Folder picker — preserves webkitRelativePath ────────────────────────
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        relativePath: file.webkitRelativePath || undefined,
      }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} files selected (folder structure preserved)`);
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getTargetPath = (): string => {
    if (isElementsMode) {
      return `${companyName}/elements/`;
    }
    let path = `${companyName}/raw-footage/`;
    if (selectedMonth) path += `${selectedMonth}/`;
    if (selectedDeliverable) path += `${selectedDeliverable}/`;
    if (subfolderName.trim()) {
      const sanitized = subfolderName.trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');
      if (sanitized) path += `${sanitized}/`;
    }
    return path;
  };

  const handleStart = async () => {
    if (selectedFiles.length === 0) return;
    if (!isElementsMode && (!selectedMonth || !selectedDeliverable)) {
      toast.error('Please select month and deliverable type');
      return;
    }

    setIsStarting(true);
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);

    const targetPath = getTargetPath();
    console.log('📁 Uploading to:', targetPath);

    const taggedEditorIds = selectedEditorIds.size > 0
      ? Array.from(selectedEditorIds).map(String)
      : undefined;
    const taskData = { clientId, taggedEditorIds };

    try {
      const firstId = await enqueueUpload(
        filesToUpload[0].file,
        taskData,
        targetPath,
        'drive',
        filesToUpload[0].relativePath  // ← folder structure preserved
      );
      setCurrentUploadId(firstId);
      setIsStarting(false);

      for (const sf of filesToUpload.slice(1)) {
        enqueueUpload(
          sf.file,
          taskData,
          targetPath,
          'drive',
          sf.relativePath  // ← folder structure preserved
        ).catch(err => console.error("Queue initiation failed:", sf.file.name, err));
      }

      toast.success(
        isElementsMode
          ? `Uploading ${filesToUpload.length} file(s) to elements`
          : `Uploading ${filesToUpload.length} file(s) to ${selectedDeliverable}/${selectedMonth}`
      );
    } catch (err) {
      console.error("Upload initiation failed:", err);
      setIsStarting(false);
      toast.error('Failed to start upload');
    }
  };

  const progress = currentUpload
    ? Math.round((currentUpload.uploadedBytes / currentUpload.fileSize) * 100)
    : 0;
  const canUpload = selectedFiles.length > 0 && (isElementsMode || (selectedMonth && selectedDeliverable));

  // Get the top-level folder name for display (if folder was dropped)
  const droppedFolderName = selectedFiles.find(sf => sf.relativePath)
    ?.relativePath?.split('/')[0];

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) {
        setSelectedFiles([]);
        setIsDragging(false);
        setCurrentUploadId(null);
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Raw Footage
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {isElementsMode ? 'Upload to Elements' : 'Upload Raw Footage'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Month / Deliverable / Subfolder — rawFootage mode only */}
          {!isElementsMode && (
            <>
              {/* Month Selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Month
                </Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Deliverable Type Selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Deliverable Type
                </Label>
                {loadingDeliverables ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading deliverables...
                  </div>
                ) : deliverables.length === 0 ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No deliverables configured for this client.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select value={selectedDeliverable} onValueChange={setSelectedDeliverable}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select deliverable type" />
                    </SelectTrigger>
                    <SelectContent>
                      {deliverables.map((d) => (
                        <SelectItem key={d.type} value={d.type}>
                          <div className="flex items-center gap-2">
                            <span>{d.type}</span>
                            {d.isOneOff && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                One-off
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Subfolder Name */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  Folder Name
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g., beach-shoot, product-launch"
                  value={subfolderName}
                  onChange={(e) => setSubfolderName(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave empty to upload directly to the deliverable folder
                </p>
              </div>

              {/* Editor Tagging — admin/manager only, raw footage only */}
              {isAdminOrManager && !isElementsMode && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Tag editors in Slack
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  {loadingEditors ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading editors...
                    </div>
                  ) : assignedEditors.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">
                      No editors currently assigned to this client.
                    </p>
                  ) : (
                    <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
                      {assignedEditors.map((editor) => (
                        <label
                          key={editor.id}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedEditorIds.has(editor.id)}
                            onCheckedChange={() => toggleEditorSelected(editor.id)}
                          />
                          <span className="flex-1 truncate">{editor.name || editor.email}</span>
                          {!editor.slackUserId && (
                            <span className="text-[10px] text-muted-foreground">No Slack linked</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {selectedEditorIds.size > 0
                      ? `${selectedEditorIds.size} editor${selectedEditorIds.size !== 1 ? "s" : ""} selected — only they will be tagged.`
                      : "Leave unselected to tag every editor currently assigned to this client (default)."}
                  </p>
                </div>
              )}

              {/* Path Preview */}
              {(selectedMonth || selectedDeliverable) && (
                <div className="bg-muted/50 rounded-lg p-3 border">
                  <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Files will be uploaded to:
                  </p>
                  <div className="font-mono text-xs flex items-center gap-1 flex-wrap">
                    <span className="text-muted-foreground">📁 {companyName}/raw-footage/</span>
                    {selectedMonth && (
                      <>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-blue-600 font-medium">{selectedMonth}/</span>
                      </>
                    )}
                    {selectedDeliverable && (
                      <>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-amber-600 font-medium">{selectedDeliverable}/</span>
                      </>
                    )}
                    {subfolderName.trim() && (
                      <>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-green-600 font-medium">
                          {subfolderName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '')}/
                        </span>
                      </>
                    )}
                    {droppedFolderName && (
                      <>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-purple-600 font-medium">{droppedFolderName}/ ...</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Elements path preview */}
          {isElementsMode && (
            <div className="bg-muted/50 rounded-lg p-3 border">
              <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                Files will be uploaded to:
              </p>
              <div className="font-mono text-xs flex items-center gap-1 flex-wrap">
                <span className="text-muted-foreground">📁 {companyName}/</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-blue-600 font-medium">elements/</span>
                {droppedFolderName && (
                  <>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-purple-600 font-medium">{droppedFolderName}/ ...</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {currentUpload && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <FileVideo className="h-4 w-4 text-blue-600" />
                  <span className="font-medium truncate max-w-[200px]">
                    {currentUpload.fileName}
                  </span>
                </div>
                <span className="text-blue-600 font-medium">{progress}%</span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-blue-600">
                {formatSize(currentUpload.uploadedBytes)} / {formatSize(currentUpload.fileSize)}
                {currentUpload.status === 'uploading' && currentUpload.speed && currentUpload.speed > 0 && (
                  <span className="text-muted-foreground ml-2">
                    • {currentUpload.speed < 1024 * 1024
                      ? `${(currentUpload.speed / 1024).toFixed(1)} KB/s`
                      : `${(currentUpload.speed / (1024 * 1024)).toFixed(1)} MB/s`}
                    {currentUpload.estimatedTimeLeft && currentUpload.estimatedTimeLeft > 0 && (
                      <span>
                        {' — '}
                        {currentUpload.estimatedTimeLeft < 60
                          ? `~${Math.round(currentUpload.estimatedTimeLeft)} sec left`
                          : currentUpload.estimatedTimeLeft < 3600
                            ? `~${Math.ceil(currentUpload.estimatedTimeLeft / 60)} min left`
                            : `~${Math.floor(currentUpload.estimatedTimeLeft / 3600)}h ${Math.round((currentUpload.estimatedTimeLeft % 3600) / 60)}m left`}
                      </span>
                    )}
                  </span>
                )}
              </p>
              {currentUpload.status === 'completed' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Upload complete!</span>
                </div>
              )}
            </div>
          )}

          {/* Drop Zone */}
          {!currentUpload && (
            <div className="space-y-2">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept="video/*,image/*"
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFolderSelect}
                  /* @ts-expect-error webkitdirectory is non-standard */
                  webkitdirectory=""
                  directory=""
                  multiple
                />
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drop files or folders here, or click to browse
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Folder structure is preserved automatically
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
              >
                <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                Upload Entire Folder
              </Button>
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground">
                {selectedFiles.length} file(s) selected
                {droppedFolderName && (
                  <span className="text-purple-600 ml-1">
                    from folder: {droppedFolderName}
                  </span>
                )}
              </p>
              {selectedFiles.map((sf, index) => (
                <div
                  key={`${sf.file.name}-${index}`}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileVideo className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {sf.relativePath || sf.file.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatSize(sf.file.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          <Button
            className="w-full"
            onClick={handleStart}
            disabled={!canUpload || isStarting || !!currentUpload}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting upload...
              </>
            ) : currentUpload ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {selectedFiles.length > 0 ? `${selectedFiles.length} File(s)` : 'Files'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}