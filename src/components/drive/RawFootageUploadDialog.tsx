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
} from "lucide-react";
import { uploadStateManager, UploadState } from "@/lib/upload-state-manager";
import { useUploads } from "../workflow/UploadContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DeliverableType {
  type: string;
  isOneOff: boolean;
  platforms: string[];
  description: string | null;
}

interface RawFootageUploadDialogProps {
  clientId: string;
  companyName: string;
  onUploadComplete: () => void;
  trigger?: React.ReactNode;
}

// Helper to generate month options (current + next 2 months)
function getMonthOptions(): { value: string; label: string; isCurrent: boolean }[] {
  const months: { value: string; label: string; isCurrent: boolean }[] = [];
  const now = new Date();
  
  for (let i = 0; i < 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthName = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    const value = `${monthName}-${year}`; // "April-2026"
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
}: RawFootageUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // New selectors
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedDeliverable, setSelectedDeliverable] = useState<string>("");
  const [subfolderName, setSubfolderName] = useState<string>("");
  
  // Deliverables from API
  const [deliverables, setDeliverables] = useState<DeliverableType[]>([]);
  const [loadingDeliverables, setLoadingDeliverables] = useState(false);
  
  // Upload state
  const [resumableUploads, setResumableUploads] = useState<UploadState[]>([]);
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notifiedUploadsRef = useRef<Set<string>>(new Set());

  const { startUpload, getUploadState } = useUploads();
  const currentUpload = currentUploadId ? getUploadState(currentUploadId) : null;
  
  const monthOptions = getMonthOptions();

  // Set default month on open
  useEffect(() => {
    if (open && !selectedMonth && monthOptions.length > 0) {
      setSelectedMonth(monthOptions[0].value);
    }
  }, [open, selectedMonth, monthOptions]);

  // Fetch deliverables when dialog opens
  useEffect(() => {
    if (open && clientId) {
      fetchDeliverables();
    }
  }, [open, clientId]);

  // Handle upload completion
  useEffect(() => {
    if (currentUpload?.status === 'completed' && !notifiedUploadsRef.current.has(currentUpload.id)) {
      notifiedUploadsRef.current.add(currentUpload.id);
      onUploadComplete();

      if (selectedFiles.length === 0) {
        setTimeout(() => {
          setOpen(false);
          setCurrentUploadId(null);
          // Reset form
          setSubfolderName("");
        }, 2000);
      }
    }
  }, [currentUpload?.status, currentUpload?.id, selectedFiles.length, onUploadComplete]);

  const fetchDeliverables = async () => {
    setLoadingDeliverables(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/deliverables`);
      if (!res.ok) throw new Error('Failed to fetch deliverables');
      
      const data = await res.json();
      
      // Extract unique types from monthly deliverables
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
      
      // Auto-select first deliverable if only one
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Build the target folder path
  const getTargetPath = (): string => {
    // Structure: CompanyName/raw-footage/April-2026/LF/subfolder-name/
    let path = `${companyName}/raw-footage/`;
    
    if (selectedMonth) {
      path += `${selectedMonth}/`;
    }
    
    if (selectedDeliverable) {
      path += `${selectedDeliverable}/`;
    }
    
    if (subfolderName.trim()) {
      // Sanitize subfolder name (replace spaces with hyphens, remove special chars)
      const sanitized = subfolderName.trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '');
      if (sanitized) {
        path += `${sanitized}/`;
      }
    }
    
    return path;
  };

  const handleStart = async () => {
    if (selectedFiles.length === 0) return;
    if (!selectedMonth || !selectedDeliverable) {
      toast.error('Please select month and deliverable type');
      return;
    }

    setIsStarting(true);
    const filesToUpload = [...selectedFiles];
    setSelectedFiles([]);

    const targetPath = getTargetPath();
    console.log('📁 Uploading to:', targetPath);

    try {
      // Start the first one and wait for it so we can show it in the UI
      const firstId = await startUpload(
        filesToUpload[0], 
        undefined, // no task
        targetPath, // use full path as subfolder
        undefined, 
        'drive' // folderType
      );
      setCurrentUploadId(firstId);
      setIsStarting(false);

      // Start the rest in parallel without awaiting
      if (filesToUpload.length > 1) {
        filesToUpload.slice(1).forEach(file => {
          startUpload(file, undefined, targetPath, undefined, 'drive').catch(err =>
            console.error("Background initiation failed:", file.name, err)
          );
        });
      }
      
      toast.success(`Uploading ${filesToUpload.length} file(s) to ${selectedDeliverable}/${selectedMonth}`);
    } catch (err) {
      console.error("Upload initiation failed:", err);
      setIsStarting(false);
      toast.error('Failed to start upload');
    }
  };

  const progress = currentUpload ? Math.round((currentUpload.uploadedBytes / currentUpload.fileSize) * 100) : 0;
  const canUpload = selectedFiles.length > 0 && selectedMonth && selectedDeliverable;

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
            Upload Raw Footage
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
                  No deliverables configured for this client. Please contact your account manager.
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

          {/* Subfolder Name (Optional) */}
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
              </div>
            </div>
          )}

          {/* Current Upload Progress */}
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
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop files here or click to browse
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Video and image files
              </p>
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              <p className="text-xs font-medium text-muted-foreground">
                {selectedFiles.length} file(s) selected
              </p>
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileVideo className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatSize(file.size)}
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