import { useState, useRef } from 'react';
import { Upload, File, X, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { VisuallyHidden } from '../ui/visually-hidden';
import { WorkflowTask, WorkflowFile, useTaskWorkflow } from './TaskWorkflowEngine';

interface FileUploadDialogProps {
  task: WorkflowTask;
  onUploadComplete?: (files: WorkflowFile[]) => void;
  trigger?: React.ReactNode;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  driveFileId?: string;
  url?: string;
  error?: string;
}

export function FileUploadDialog({ task, onUploadComplete, trigger }: FileUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createQCReviewTask } = useTaskWorkflow();

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newUploadingFiles: UploadingFile[] = Array.from(files).map(file => ({
      id: `upload-${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'uploading'
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Simulate file uploads
    newUploadingFiles.forEach(uploadingFile => {
      simulateGoogleDriveUpload(uploadingFile);
    });
  };

  const simulateGoogleDriveUpload = async (uploadingFile: UploadingFile) => {
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadingFiles(prev => prev.map(f => {
          if (f.id === uploadingFile.id && f.progress < 95) {
            return { ...f, progress: f.progress + Math.random() * 15 };
          }
          return f;
        }));
      }, 200);

      // Simulate upload completion after 2-4 seconds
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));
      
      clearInterval(progressInterval);

      // Simulate successful upload to Google Drive
      const driveFileId = `drive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const driveUrl = `https://drive.google.com/file/d/${driveFileId}/view`;

      setUploadingFiles(prev => prev.map(f => {
        if (f.id === uploadingFile.id) {
          return {
            ...f,
            progress: 100,
            status: 'completed',
            driveFileId,
            url: driveUrl
          };
        }
        return f;
      }));

    } catch (error) {
      setUploadingFiles(prev => prev.map(f => {
        if (f.id === uploadingFile.id) {
          return {
            ...f,
            status: 'error',
            error: 'Upload failed. Please try again.'
          };
        }
        return f;
      }));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeFile = (fileId: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    // You could add more specific icons based on file type
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canCompleteTask = uploadingFiles.length > 0 && uploadingFiles.every(f => f.status === 'completed');
  const hasErrors = uploadingFiles.some(f => f.status === 'error');
  const isUploading = uploadingFiles.some(f => f.status === 'uploading');

  const handleCompleteTask = async () => {
    if (!canCompleteTask) return;

    try {
      // Convert uploaded files to WorkflowFile format
      const workflowFiles: WorkflowFile[] = uploadingFiles.map(f => ({
        id: f.driveFileId || f.id,
        name: f.file.name,
        url: f.url || '#',
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'current-user', // In real app, this would be the authenticated user
        driveFileId: f.driveFileId,
        mimeType: f.file.type,
        size: f.file.size
      }));

      // Create QC review task automatically
      await createQCReviewTask(task, workflowFiles);

      // Mark original task as completed
      // In a real app, you'd update the task status via API
      
      onUploadComplete?.(workflowFiles);
      setOpen(false);
      
      // Reset state
      setUploadingFiles([]);
      setCompletionNotes('');
      
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload & Complete
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="upload-dialog-description">
        <DialogHeader>
          <DialogTitle id="upload-dialog-title">Complete Task & Upload Files</DialogTitle>
          <DialogDescription id="upload-dialog-description">
            Upload your completed files to Google Drive. Once uploaded, a QC review task will be automatically created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Info */}
          <div className="p-4 bg-accent/50 rounded-lg">
            <h4 className="font-medium mb-1">{task.title}</h4>
            <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {/* {task.type.replace('_', ' ')} */}
                {task.type ? task.type.replace('_', ' ') : 'Unknown'}

              </Badge>
              <Badge variant={
                task.priority === 'urgent' ? 'destructive' :
                task.priority === 'high' ? 'default' :
                'secondary'
              }>
                {task.priority} priority
              </Badge>
            </div>
          </div>

          {/* File Upload Area */}
          <div 
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="mb-2">Drop files here or click to browse</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Support for images, videos, documents, and other file types
            </p>
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              Select Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />
          </div>

          {/* Uploading Files */}
          {uploadingFiles.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Uploading Files</h4>
              {uploadingFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(file.file.name)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file.size)}
                      </p>
                    </div>
                  </div>

                  {file.status === 'uploading' && (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Progress value={file.progress} className="flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(file.progress)}%
                      </span>
                    </div>
                  )}

                  {file.status === 'completed' && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => window.open(file.url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {file.status === 'error' && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </div>
                  )}

                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => removeFile(file.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Completion Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Completion Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about the completed work..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Success Alert */}
          {canCompleteTask && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                All files uploaded successfully! Ready to complete task and create QC review.
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {hasErrors && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Some files failed to upload. Please remove and try again.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCompleteTask}
            disabled={!canCompleteTask || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Complete Task & Create QC Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}